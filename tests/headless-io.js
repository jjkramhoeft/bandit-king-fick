// An io that answers every prompt automatically, for running whole games under Node.
module.exports = function headlessIO(opts) {
  opts = opts || {};
  const lines = [];
  const io = {
    lines,
    newMonth: async () => {},
    event: async (ev) => { lines.push(ev.text); },
    say: async (t) => { lines.push(t); },
    news: async (t) => { lines.push(t); },
    chieftain: async (id, t) => { lines.push(t); },
    confirm: async () => !!opts.yes,
    focus: async () => {},
    refresh: async () => {},
    battle: async (b) => { b.autoResolve(); },
    gameOver: async (s, outcome) => { io.outcome = outcome; },
    autosave: () => {}
  };
  return io;
};
