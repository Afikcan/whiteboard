import './App.css';
import io from "socket.io-client"
import CanvasDesigner from "./whiteboard"
import { useEffect, useState } from 'react'
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration
} from 'amazon-chime-sdk-js';

let logger
let deviceController
let configuration
let observer
let meetingSession

const socket = io.connect("http://localhost:3001")

var designer = new CanvasDesigner();
designer.widgetHtmlURL = 'https://www.webrtc-experiment.com/Canvas-Designer/widget.html';
designer.widgetJsURL = 'https://www.webrtc-experiment.com/Canvas-Designer/widget.js';

designer.appendTo(document.getElementById('whiteboard-frame') || document.documentElement);

let drawing = {
  points: [],
  startIndex: 0
}

const displaySavedImage =  async (link) => {
  var response = await fetch(link)
  console.log(response)
}

function App() {
  const [meetingResponse, setMeetingResponse] = useState({})
  const [attendeeResponse, setAttendeeResponse] = useState({})

  // function for what will we do after we get data by using getMessage
  const receiveDataMessageHandler = async (data) => {
    data = JSON.parse(new TextDecoder().decode(data.data))

    if(data.state === "drawing"){
      for(let i = 0; i < data.points.length;  i++ ){
        drawing.points.push(data.points[i])
      }
    }else if(data.state === "end"){
      drawing.startIndex = data.startIndex
      designer.syncData(drawing)
      drawing.points = []
    }

    if(data.state === "image"){
      async function loadImages() {
        const response = await fetch(data.link);
        const allDrawings = await response.json();

        designer.syncData(allDrawings)
      }
      loadImages();
    }
  }

  // function for sending data chunks to subscribed users to the topic
  const sendMessage = (topic, data, lifetimeMs, audioVideo) => {
    audioVideo.realtimeSendDataMessage(topic, data, lifetimeMs)
  }

  // function for to subscribe to any topic
  const getMessage = (topic, audioVideo) => {
    try {
      audioVideo.realtimeSubscribeToReceiveDataMessage(topic, receiveDataMessageHandler)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    designer.addSyncListener(function (data) {
      if(data.points[data.points.length-1][0] === "image" || data.points[data.points.length-1][0] === "pdf"){
        socket.emit("sendAllDrawings", JSON.stringify(data))

        socket.on("sendLinkImages", (link) => {
          sendMessage("drawing", {
            state: "image",
            link
          }, 50000, meetingSession.audioVideo)
        })
        
      }else{
        let chunkSize = 7
        let chunkNum = Math.ceil(data.points.length/chunkSize) 

        for(let i = 0; i < chunkNum; i++){
          let points = data.points.splice(0,chunkSize)

          sendMessage("drawing", {
            state: "drawing",
            points,
          }, 50000, meetingSession.audioVideo)
        }
        sendMessage("drawing", {
          state: "end",
          startIndex: data.startIndex
        }, 50000, meetingSession.audioVideo)
      }
    });
  }, []);


  useEffect(() => {
    socket.emit("savedFiles", "room-1/")
    socket.on("savedFilesArray", (files) => {
      var options = "<option value='0'>SELECT</option>"
      for(var i = 0; i<files.length; i++){
        options += "<option value='"+files[i]+"'>"+files[i]+"</option>"
      }
      document.getElementById("slctImg").innerHTML = options
    }, [])
    
    socket.on("sendConfigs", (data) => {
      setAttendeeResponse(data.attendeeResponse)
      setMeetingResponse(data.meetingResponse)
    })
    main()
    
  })

  let main = async () => {

    logger = new ConsoleLogger('MyLogger', LogLevel.INFO);

    deviceController = new DefaultDeviceController(logger);

    configuration = new MeetingSessionConfiguration(meetingResponse, attendeeResponse);

    // In the usage examples below, you will use this meetingSession object.
    meetingSession = new DefaultMeetingSession(
      configuration,
      logger,
      deviceController
    );

    observer = {
      audioVideoDidStart: () => {
        console.log('Started');
      },
      audioVideoDidStop: sessionStatus => {
        // See the "Stopping a session" section for details.
        console.log('Stopped with a session status code: ', sessionStatus.statusCode());
      },
      audioVideoDidStartConnecting: reconnecting => {
        if (reconnecting) {
          // e.g. the WiFi connection is dropped.
          console.log('Attempting to reconnect');
        }
      }
    };

    meetingSession.audioVideo.addObserver(observer);
    meetingSession.audioVideo.start();
  }

  return (
    <div className="App">
      <h1>Mounted</h1>
      <button onClick={() => {
        sendMessage("drawing", JSON.stringify(drawing), 50000, meetingSession.audioVideo)
      }}>SEND A MESSAGE</button>
      <button onClick={() => {
        getMessage("drawing", meetingSession.audioVideo)
      }}>GET A MESSAGE</button>
      <button onClick={() => {
        designer.undo()
      }}>UNDO</button>
      <button onClick={() => {
        designer.toDataURL("img",(data) => {
          data = {
            img: data,
            eventName: "room-1"
          }
          console.log(data)
          socket.emit("screenShot",data)
        })
      }}>SCREEN SHOT</button>
      
      <select id='slctImg' onChange={()=>{
        var data = {
          state: "image",
          link: "https://whiteboard-storage-afyque.s3.eu-west-3.amazonaws.com/room-1/" + document.getElementById("slctImg").value
        }
        displaySavedImage(data.link)
      }}>
      </select>
      
    </div>
  );
}

export default App;
