let client = null;
module.exports = {
    setClient: (value) => { client = value; },
    getClient: () => { return client; },
};
