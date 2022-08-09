import { KinesisClient, ListStreamConsumersCommand, GetShardIteratorCommand, ListShardsCommand } from "@aws-sdk/client-kinesis";
import AWS from 'aws-sdk';
import path from 'path';

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION,
});

(async () => {
    const client = new KinesisClient({ region: process.env.REGION });
    const listShards = new ListStreamConsumersCommand({
        StreamARN: "arn:aws:kinesis:us-east-2:910556394401:stream/iot-data-stream"
    });
    const response = await client.send(listShards);
    console.log(response);

    // const kinesis = new AWS.Kinesis({}).getRecords({ shar})


})()
// const getShardIterator = new GetShardIteratorCommand({
//     StreamName: "iot-data-stream",
//     sh
// });

// const command = new GetRecordsCommand({ Limit: 100 });



(async () => {
    await kinesis.startConsumer();
    console.log("started");

    for await (const chunk of kinesis) {
        console.log(chunk.length);
        start = new Date();
        console.log("new chunk", chunk.records.length, start);
        let logBatchInsert = [];
        let deviceDataUpdate = deviceData.collection.initializeUnorderedBulkOp();
        for await (const data of chunk.records) {
            // console.log(singleMessage);
            count++;
            // if (count % 100 === 0)
            //     console.log(data.data.reportedAt, count);
            const body = data.data;
            try {
                // console.log("entering single message processor");
                const date = moment.utc(body.reportedAt).toDate();
                body.reportedAt = isNaN(date) ? moment.utc(body.reportedAt, "YYYY-DD-MM hh:mm:ss").toDate() : date;
                // console.log("postdatahandlet start");
                const res = await postDataHelper(body);
                // console.log("postdatahandler end");

                //alerts pushing to queue - start
                // console.log("pushing to alerts queue");
                const errors = alertError(res.data, value);
                if (errors.length) {
                    const params = {
                        MessageAttributes: {
                            timestamp: {
                                DataType: "String",
                                StringValue: moment().toISOString(),
                            },
                        },
                        MessageBody: JSON.stringify({
                            ...res.data,
                            errors,
                            reportedAt: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                        }),
                        QueueUrl: process.env.ALERT_QUEUE,
                    };
                    // console.log("sending alerts", params);
                    sqs.sendMessage(params, function (err, data) {
                        if (err) {
                            console.log("Error in sending to alert data", err);
                        } else {
                            // console.log("Success in sending to alert data", data);
                        }
                    });
                    // console.log("done pushing to alerts queue");
                }

                //alerts pushing to queue - end

                deviceDataUpdate
                    .find({ deviceId: res.data.deviceId })
                    .upsert()
                    .updateOne([
                        {
                            $set: {
                                ...res.data,
                                error: res.error,
                                key: {
                                    $concat: [
                                        { $literal: "$" },
                                        { $toString: res.data.key.substring(1) },
                                    ],
                                },
                                previousReportedAt: "$reportedAt",
                            },
                        },
                    ]);
                // console.log("pushing to batches");

                logBatchInsert.push({
                    ...res.data,
                });

                // console.log("pushing to batches done");
            } catch (error) {
                console.log(error, "error in single message", body);
            }
        }

        try {
            const dbQueries = [];

            if (logBatchInsert.length) {
                // console.log("trying to insert to log batch data");
                const logDataQueries = logData.insertMany(logBatchInsert);
                dbQueries.push(logDataQueries);
                // console.log("Log Data logged:", logBatchInsert.length);
            }

            if (deviceDataUpdate.batches.length) {
                // console.log("trying to insert to device data");
                const deviceDataUpdateQuery = deviceDataUpdate.execute();
                dbQueries.push(deviceDataUpdateQuery);
            } else {
                console.log("not executing bulk ops because batch empty");
            }
            // console.log(" device data logged ");

            const queryResponse = await Promise.all(dbQueries)
            // console.log("All queries executed", queryResponse);

        } catch (error) {
            console.log("queries not executed", error);
        }
        console.log("done with inner loop", new Date() - start);
    }

})()