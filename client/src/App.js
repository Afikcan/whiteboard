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


function App() {
  

  const [meetingResponse, setMeetingResponse] = useState({})
  const [attendeeResponse, setAttendeeResponse] = useState({})


  const receiveDataMessageHandler = (data) => {
    data = JSON.parse(new TextDecoder().decode(data.data))

    if(data.state === "drawing"){
      //drawing.points.push(data.point) Pushwant
      for(let i = 0; i < data.points.length;  i++ ){
        drawing.points.push(data.points[i])
      }
    }else if(data.state === "end"){
      drawing.startIndex = data.startIndex
      designer.syncData(drawing)
      drawing.points = []
    }
  }

  const sendMessage = (topic, data, lifetimeMs, audioVideo) => {
    audioVideo.realtimeSendDataMessage(topic, data, lifetimeMs)
  }

  const getMessage = (topic, audioVideo) => {
    try {
      audioVideo.realtimeSubscribeToReceiveDataMessage(topic, receiveDataMessageHandler)
    } catch (error) {
      console.log("error")
    }
  }

  useEffect(() => {
    designer.addSyncListener(function (data) {

      /*
      if(data.points[data.points.length-1][0] === "image" || "pdf"){
        //let state = console.log(data.points[data.points.length-1][0])
        console.log(data.points[data.points.length-1])
        /*
        sendMessage(state, {
          state,
          points: data.points[data.points.length-1], //for images we just wanna send last point 
        }, 50000, meetingSession.audioVideo)
        
      }
      */
      
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
      
      /*
      Pushwant
      data.points.forEach(d=>{
        sendMessage("drawing", {
          state: "drawing",
          point: d
        }, 50000, meetingSession.audioVideo)
      });
      sendMessage("drawing", {
        state: "end",
        startIndex: data.startIndex
      }, 50000, meetingSession.audioVideo)
      */
    });
  }, []);


  useEffect(() => {
    socket.on("sendConfigs", (data) => {
      setAttendeeResponse(data.attendeeResponse)
      setMeetingResponse(data.meetingResponse)
    })
    main()
  })

  let main = async () => {
    console.log("After we got in main")
    console.log(attendeeResponse)

    logger = new ConsoleLogger('MyLogger', LogLevel.INFO);

    deviceController = new DefaultDeviceController(logger);

    configuration = new MeetingSessionConfiguration(meetingResponse, attendeeResponse);

    // In the usage examples below, you will use this meetingSession object.
    meetingSession = new DefaultMeetingSession(
      configuration,
      logger,
      deviceController
    );
    console.log("MEETINGSESSION")
    console.log(typeof (meetingSession.audioVideo))
    console.log(meetingSession.audioVideo)

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
    await meetingSession.audioVideo.start();
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
    </div>
  );
}

export default App;
