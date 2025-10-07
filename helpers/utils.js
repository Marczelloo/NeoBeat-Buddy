module.exports = {
  formatDuration: function (ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return [hours, minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")].join(":");
    }

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  },
};
