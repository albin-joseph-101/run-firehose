require('dotenv').config();
module.exports = {
  development: {
    consumerGroup: process.env.DEV_CONSUMER_GROUP,
  },
  production: {
    consumerGroup: process.env.PROD_CONSUMER_GROUP,
  },
};