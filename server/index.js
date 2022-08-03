const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const url = require('url')
const fetch = require('node-fetch')

const { v4: uuid } = require('uuid');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({ region: 'eu-west-3'})

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

    socket.on("sendAllDrawings", (allDrawings) => {
        let fileName = "room-1.json"
        var params_putObject = {
            Body: allDrawings, 
            Bucket: "whiteboard-storage-afyque",
            Key: fileName,
            ContentType: "application/json",
            ACL: "public-read"
        };
        console.log(typeof(allDrawings))
        
        s3.putObject(params_putObject , function(err, data) {
            if (err) console.log(err, err.stack);
            else {
                console.log(data)
                socket.emit("sendLinkImages","https://whiteboard-storage-afyque.s3.eu-west-3.amazonaws.com/"+fileName)
            };
        });
    })
    
    socket.on("screenShot",(ssData) => {
        let ssNumber = 0

        var params_listObjects = {
            Bucket: "whiteboard-storage-afyque", 
        };

        s3.listObjects(params_listObjects, function(err, data) {
        let lettreNo = ssData.eventName.length
            if (err) console.log(err, err.stack); // an error occurred
            else{
            for(let i = 0; i<data.Contents.length; i++){
                if(data.Contents[i].Key.slice(0,lettreNo) === ssData.eventName ){
                    ssNumber = ssNumber + 1
                    console.log(ssNumber)
                }
            }
            }
        });

        var params_putObject = {
            Body: ssData.img, 
            Bucket: "whiteboard-storage-afyque/" + ssData.eventName,
            Key: "ss-" + ssNumber + ".txt",
            ContentType: "string",
            ACL: "public-read"
        };

        console.log(ssNumber)
        console.log(params_putObject.Key)
        
        s3.putObject(params_putObject , function(err, data) {
            if (err) console.log(err, err.stack);
            else {
                console.log(data)
            };
        });
    })
    
    socket.on("savedFiles", (roomName) => {
        var params_listObjects = {
            Bucket: "whiteboard-storage-afyque", 
        };
        s3.listObjects(params_listObjects, function(err, data) {
        let lettreNo = roomName.length
        let files = []
            if (err) console.log(err, err.stack); // an error occurred
            else{
            for(let i = 0; i<data.Contents.length; i++){
                if(data.Contents[i].Key.slice(0,lettreNo) === roomName ){
                    files.push(data.Contents[i].Key.slice(lettreNo,data.Contents[i].Key.length))
                }
            }
            socket.emit("savedFilesArray",files)
            }
        });
    })
})

server.listen(3001, () => {
    console.log('Server is running')
})