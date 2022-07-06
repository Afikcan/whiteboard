const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const { v4: uuid } = require('uuid');
const AWS = require('aws-sdk');


const chime = new AWS.Chime({ region: 'us-east-1' });
chime.endpoint = new AWS.Endpoint('https://service.chime.aws.amazon.com');

const app = express().use(cors())
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET","POST"],
    },
})

let configs = {
    meetingResponse: "",
    attendeeResponse: "",
}


let main = async() =>{
    var params_createMeeting = {
        ClientRequestToken: uuid(), /* required */
        MediaRegion: 'us-east-1',
        MeetingHostId: 'meeting-no-1',
        Tags: [
        {
            Key: 'meeting_no', /* required */
            Value: '1' /* required */
        },
        ]
    };
    configs.meetingResponse  = await chime.createMeeting(params_createMeeting).promise();

    var params_createAttendee = {
    ExternalUserId: uuid(),
    MeetingId: configs.meetingResponse.Meeting.MeetingId, 
    Tags: [
        {
        Key: 'attendee_no', 
        Value: '1' 
        },
    ]
    };
    configs.attendeeResponse = await chime.createAttendee(params_createAttendee).promise();
}

main()

io.on('connection', (socket) => {
    console.log('User connected: ' + socket.id)

    socket.emit("sendConfigs", configs)
})

server.listen(3001, () => {
    console.log('Server is running')
})