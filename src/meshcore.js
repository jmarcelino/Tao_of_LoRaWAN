const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const PACKET = {
  OK: 0x00,
  ERROR: 0x01,
  SELF_INFO: 0x05,
  MSG_SENT: 0x06,
  CONTACT_MSG: 0x07,
  CHANNEL_MSG: 0x08,
  NO_MORE: 0x0a,
  DEVICE_INFO: 0x0d,
  CONTACT_MSG_V3: 0x10,
  CHANNEL_MSG_V3: 0x11,
  CHANNEL_INFO: 0x12,
  CHANNEL_DATA: 0x1b,
  MESSAGES_WAITING: 0x83,
};

const ERROR_MESSAGES = {
  1: "The radio does not support that command.",
  2: "The Public channel was not found on this radio.",
  3: "The radio queue is full. Try again in a moment.",
  4: "The radio is busy. Try again in a moment.",
  5: "The radio reported a storage error.",
  6: "The radio rejected the message format.",
};

function friendlyError(error) {
  if (error?.name === "NotFoundError") return "No companion selected. You can still use the labelled example.";
  if (error?.name === "SecurityError") return "Bluetooth needs a secure HTTPS page and a user gesture.";
  if (error?.name === "NetworkError") return "The Bluetooth connection failed. Bring the radio closer and retry.";
  return error?.message || "Bluetooth connection failed.";
}

export class MeshCoreClient {
  constructor({ onState, onStatus, onMessage }) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.device = null;
    this.rx = null;
    this.tx = null;
    this.connected = false;
    this.queue = [];
    this.current = null;
    this.pollTimer = null;
    this.pollQueued = false;
    this.pollPending = false;
    this.waitingNotice = false;
    this.publicChannelName = null;
    this.seen = new Set();
    this.boundNotification = event => {
      const value = event.target.value;
      this.handleNotification(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    };
    this.boundDisconnect = () => this.handleDisconnect();
  }

  static supported() {
    return Boolean(navigator.bluetooth && window.isSecureContext);
  }

  async connect() {
    if (!window.isSecureContext) throw new Error("WebBluetooth requires HTTPS or localhost.");
    if (!navigator.bluetooth) throw new Error("This browser does not expose WebBluetooth. Use Chrome or Edge on a supported device.");
    this.onStatus("Choose a MeshCore companion radio…");
    if (!this.device) {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      this.device.addEventListener("gattserverdisconnected", this.boundDisconnect);
    }

    this.onStatus(`Connecting to ${this.device.name || "MeshCore companion"}…`);
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    this.rx = await service.getCharacteristic(RX_UUID);
    this.tx = await service.getCharacteristic(TX_UUID);
    await this.tx.startNotifications();
    this.tx.addEventListener("characteristicvaluechanged", this.boundNotification);
    this.connected = true;

    try {
      const appStart = new Uint8Array([0x01, 0, 0, 0, 0, 0, 0, 0, ...encoder.encode("Tao of LoRaWAN")]);
      await this.enqueue(appStart, [PACKET.SELF_INFO]);
      const deviceInfo = await this.enqueue(new Uint8Array([0x16, 0x03]), [PACKET.DEVICE_INFO]);
      const model = this.parseDeviceInfo(deviceInfo);
      const channelInfo = await this.enqueue(new Uint8Array([0x1f, 0x00]), [PACKET.CHANNEL_INFO]);
      this.publicChannelName = this.parseChannelInfo(channelInfo);
      if (this.publicChannelName?.toLowerCase() !== "public") {
        const actual = this.publicChannelName ? `“${this.publicChannelName}”` : "unnamed or unavailable";
        throw new Error(`Channel 0 is ${actual}, not the built-in Public channel. Check the companion’s channel configuration.`);
      }
      this.onState(true, model || this.device.name || "MeshCore companion");
      this.onStatus(`Connected to ${this.publicChannelName} / channel 0. Listening for replies.`);
      this.startPolling();
      this.requestNextMessage();
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.connected = false;
    this.pollQueued = false;
    this.pollPending = false;
    this.waitingNotice = false;
    this.publicChannelName = null;
    this.rejectQueue(new Error("Companion disconnected."));
    if (this.tx) {
      try { this.tx.removeEventListener("characteristicvaluechanged", this.boundNotification); } catch { /* already gone */ }
      try { await this.tx.stopNotifications(); } catch { /* already gone */ }
    }
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.rx = null;
    this.tx = null;
    this.onState(false);
  }

  handleDisconnect() {
    const wasConnected = this.connected;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.connected = false;
    this.pollQueued = false;
    this.pollPending = false;
    this.waitingNotice = false;
    this.publicChannelName = null;
    this.rejectQueue(new Error("Companion disconnected."));
    this.rx = null;
    this.tx = null;
    this.onState(false);
    if (wasConnected) this.onStatus("Companion disconnected. Select Connect companion to reconnect.");
  }

  enqueue(bytes, expected, timeout = 5000, priority = false) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.rx) return reject(new Error("Connect a companion first."));
      const command = { bytes, expected, timeout, resolve, reject, priority };
      if (priority) this.queue.unshift(command);
      else this.queue.push(command);
      this.pump();
    });
  }

  async pump() {
    if (this.current || !this.queue.length || !this.connected) return;
    this.current = this.queue.shift();
    try {
      await this.rx.writeValueWithResponse(this.current.bytes);
      this.current.timer = setTimeout(() => {
        const timedOut = this.current;
        this.current = null;
        timedOut?.reject(new Error(timedOut?.priority
          ? "No send confirmation from the radio yet. Wait a moment before retrying to avoid a duplicate."
          : "The companion did not answer in time."));
        this.pump();
      }, this.current.timeout);
    } catch (error) {
      const failed = this.current;
      this.current = null;
      failed?.reject(error);
      this.pump();
    }
  }

  rejectQueue(error) {
    if (this.current) {
      clearTimeout(this.current.timer);
      this.current.reject(error);
      this.current = null;
    }
    for (const command of this.queue) command.reject(error);
    this.queue = [];
  }

  handleNotification(data) {
    if (!data.length) return;
    const type = data[0];
    if (type === PACKET.MESSAGES_WAITING) {
      this.waitingNotice = true;
      this.onStatus("A mesh message is waiting…");
      this.requestNextMessage(true);
      return;
    }

    if (this.current && this.current.expected.includes(type)) {
      const command = this.current;
      this.current = null;
      clearTimeout(command.timer);
      command.resolve(data);
      this.handleMessagePacket(data);
      this.pump();
      return;
    }

    if (this.current && type === PACKET.ERROR) {
      const command = this.current;
      this.current = null;
      clearTimeout(command.timer);
      command.reject(new Error(ERROR_MESSAGES[data[1]] || `The radio returned error ${data[1] || "unknown"}.`));
      this.pump();
      return;
    }

    this.handleMessagePacket(data);
  }

  handleMessagePacket(data) {
    if ([PACKET.CONTACT_MSG, PACKET.CONTACT_MSG_V3, PACKET.CHANNEL_MSG, PACKET.CHANNEL_MSG_V3, PACKET.CHANNEL_DATA].includes(data[0])) {
      this.waitingNotice = false;
    }
    if ([PACKET.CONTACT_MSG, PACKET.CONTACT_MSG_V3].includes(data[0])) {
      this.onStatus("A direct message was received. This demo only displays Public channel messages.");
      return;
    }
    if (data[0] === PACKET.CHANNEL_DATA) {
      this.onStatus("A channel data packet was received. This demo displays Public text messages only.");
      return;
    }
    if (![PACKET.CHANNEL_MSG, PACKET.CHANNEL_MSG_V3].includes(data[0])) return;
    const message = this.parseChannelMessage(data);
    if (!message) return;
    if (message.channel !== 0) {
      this.onStatus(`A message arrived on channel ${message.channel}. Only Public / channel 0 is shown here.`);
      return;
    }
    if (!message.text) return;
    const key = `${message.timestamp}|${message.channel}|${message.text}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
    this.onMessage({ ...message, live: true, direction: "incoming" });
    this.onStatus("Live reply received from the Public channel.");
  }

  parseChannelInfo(data) {
    if (data[0] !== PACKET.CHANNEL_INFO || data[1] !== 0 || data.length < 34) return null;
    const name = data.slice(2, 34);
    // Firmware uses strcpy() here, so bytes after the first terminator may be
    // stale data from an earlier response. They are not part of the name.
    const terminator = name.indexOf(0);
    const end = terminator === -1 ? name.length : terminator;
    return decoder.decode(name.slice(0, end)).trim() || null;
  }

  parseChannelMessage(data) {
    const type = data[0];
    const offset = type === PACKET.CHANNEL_MSG_V3 ? 4 : 1;
    const minimum = offset + 7;
    if (data.length < minimum) return null;
    const channel = data[offset];
    const pathLength = data[offset + 1];
    const textType = data[offset + 2];
    const view = new DataView(data.buffer, data.byteOffset + offset + 3, 4);
    const timestamp = view.getUint32(0, true);
    let snr = null;
    if (type === PACKET.CHANNEL_MSG_V3) {
      const signed = data[1] > 127 ? data[1] - 256 : data[1];
      snr = signed / 4;
    }
    return { channel, pathLength, textType, timestamp, snr, text: decoder.decode(data.slice(offset + 7)) };
  }

  parseDeviceInfo(data) {
    if (data.length >= 80 && data[1] >= 3) {
      return decoder.decode(data.slice(20, 60)).replaceAll("\0", "").trim() || null;
    }
    return null;
  }

  async sendPublic(text) {
    const payload = encoder.encode(text.trim());
    if (!payload.length) throw new Error("Write a message first.");
    if (payload.length > 133) throw new Error("MeshCore public text is limited to 133 bytes in this demo.");
    const timestamp = Math.floor(Date.now() / 1000);
    const packet = new Uint8Array(7 + payload.length);
    packet.set([0x03, 0x00, 0x00]);
    new DataView(packet.buffer).setUint32(3, timestamp, true);
    packet.set(payload, 7);
    this.onStatus("Sending to the Public channel…");
    // Channel sends return OK in firmware; accept MSG_SENT for documented variants.
    await this.enqueue(packet, [PACKET.OK, PACKET.MSG_SENT], 15000, true);
    this.onMessage({ text: text.trim(), timestamp, live: true, direction: "outgoing" });
    this.onStatus("Sent to Public. Waiting for someone on the other side…");
    this.requestNextMessage();
  }

  startPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.requestNextMessage(), 5000);
  }

  requestNextMessage(fromPush = false) {
    if (!this.connected) return;
    if (this.pollQueued) {
      if (fromPush) this.pollPending = true;
      return;
    }
    this.pollQueued = true;
    this.enqueue(
      new Uint8Array([0x0a]),
      [PACKET.CHANNEL_MSG, PACKET.CHANNEL_MSG_V3, PACKET.CONTACT_MSG, PACKET.CONTACT_MSG_V3, PACKET.CHANNEL_DATA, PACKET.NO_MORE],
    ).then(data => {
      if (data[0] === PACKET.NO_MORE) {
        if (this.waitingNotice) {
          this.waitingNotice = false;
          this.onStatus("The waiting notice did not produce a Public text reply. Still listening on channel 0.");
        }
      } else {
        this.pollPending = true;
      }
    }).catch(() => {
      // A background poll must never overwrite the status of a user-initiated send.
    }).finally(() => {
      this.pollQueued = false;
      if (this.pollPending && this.connected) {
        this.pollPending = false;
        this.requestNextMessage(true);
      }
    });
  }
}

export { friendlyError };
