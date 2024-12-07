import mqtt from 'mqtt';
const brokerUrl = 'ws://broker.hivemq.com:8000/mqtt';

//const brokerUrl = 'mqtt://broker.hivemq.com';
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
    console.log('Connected to MQTT broker');
});

export const publishKeypoints = (keypoints) => {
    const topic = 'yoga/keypoints';

    const message = JSON.stringify({
       
        keypoints:keypoints,
    });
    

    client.publish(topic, message, { qos: 1 }, (error) => {
        if (error) {
            console.error('Failed to publish keypoints:', error);
        } else {
            console.log('Keypoints published successfully');
        }
    });
};
