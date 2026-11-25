const clients = new Map();

const getClientKey = (type, id) => `${type}_${String(id).trim()}`;

const addClient = (req, res, type, id, { heartbeatMs = 20000 } = {}) => {
  const key = getClientKey(type, id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n');

  if (!clients.has(key)) {
    clients.set(key, new Set());
  }
  clients.get(key).add(res);

  const heartbeat = setInterval(() => {
    if (res.destroyed || res.writableEnded) {
      cleanup();
      return;
    }
    res.write(': keep-alive\n\n');
  }, heartbeatMs);
  heartbeat.unref?.();

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    const group = clients.get(key);
    if (group) {
      group.delete(res);
      if (group.size === 0) {
        clients.delete(key);
      }
    }
  };

  res.on('close', cleanup);
  res.on('error', cleanup);
};

const sendEvent = (type, id, data) => {
  const key = getClientKey(type, id);
  const group = clients.get(key);
  
  if (group) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    group.forEach((res) => {
      // Send the payload to the specific active client channels
      res.write(message);
    });
  }
};

module.exports = {
  addClient,
  sendEvent,
};
