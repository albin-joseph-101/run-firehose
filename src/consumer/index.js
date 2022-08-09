import { config, Firehose } from 'aws-sdk'
import path from 'path';
const { Kafka } = require('kafkajs');

import configPath from "../config/config"
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const env = process.env.NODE_ENV || 'development';
const configValues = configPath[env];
console.log(configValues.consumerGroup);

config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION,
});
console.log({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION,
    path: path.join(__dirname, '../.env')
});

const streamToFirehose = async (arrayOfRecords) => {

    var params = {
        Records: arrayOfRecords,
        DeliveryStreamName: "iot-stream-data-backup"
    };

    const firehouse = new Firehose();

    return new Promise((resolve, reject) => {
        firehouse.putRecordBatch(params, function (err, data) {
            if (err) {
                console.error("couldn't stream", err.stack);
                reject(err)
            }
            else {
                console.log("INFO - successfully send stream");
                resolve(data)
            }
        });
    });

}

(async () => {

    const kafka = new Kafka({
        clientId: 'iot-msk-producer',
        brokers: [
            "b-2.iotstream.rnnl6v.c6.kafka.us-east-2.amazonaws.com:9094",
            "b-1.iotstream.rnnl6v.c6.kafka.us-east-2.amazonaws.com:9094",
            "b-3.iotstream.rnnl6v.c6.kafka.us-east-2.amazonaws.com:9094",
        ],
        ssl: true
    });

    const consumer = kafka.consumer({ groupId: configValues.consumerGroup })

    await consumer.connect()
    let arrayOfRecords = [];

    await consumer.subscribe({ topic: 'iot-data-stream', fromBeginning: false })
    await consumer.run({

        eachBatch: async ({ batch, resolveOffset, isRunning, isStale }) => {

            const start = new Date();
            // console.log({
            //     topic: batch?.topic,
            //     partition: batch?.partition,
            //     lastCommittedOffset: batch?.highWatermark,
            // })

            for (let message of batch.messages) {
                if (!isRunning() || isStale())
                    break;
                arrayOfRecords.push({ Data: Buffer.from(JSON.stringify(message)) });
                if (arrayOfRecords.length === 500) {
                    console.log("pushing to firehose");
                    await streamToFirehose(arrayOfRecords);
                    console.log("pushed to firehose");
                    console.log(message.offset)
                    arrayOfRecords = [];
                }


                // console.log("resolving offset", new Date() - start);
                resolveOffset(message.offset);
                // console.log("done resolving offset", new Date() - start);

                //await heartbeat();
            }

        }
    })

})()