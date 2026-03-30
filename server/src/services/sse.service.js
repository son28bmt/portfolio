const clients = new Map();

const getClientKey = (type, id) => `${type}_${String(id).trim()}`;

const addClient = (req, res, type, id) => {
  const key = getClientKey(type, id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(': connected\n\n');

  if (!clients.has(key)) {
    clients.set(key, new Set());
  }
  clients.get(key).add(res);

  req.on('close', () => {
    const group = clients.get(key);
    if (group) {
      group.delete(res);
      if (group.size === 0) {
        clients.delete(key);
      }
    }
  });
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
