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

let allDrawings = {
  points: [],
  startIndex: 0
}

let startIndexStock = 0

let base64EncodedStr

function App() {
  const [meetingResponse, setMeetingResponse] = useState({})
  const [attendeeResponse, setAttendeeResponse] = useState({})


  // function for what will we do after we get data by using getMessage
  const receiveDataMessageHandler = async (data) => {
    data = JSON.parse(new TextDecoder().decode(data.data))

    if(data.state === "drawing"){
      console.log("BEFORE PUSH")
      console.log(data.points)
      for(let i = 0; i < data.points.length;  i++ ){
        drawing.points.push(data.points[i])
        
        allDrawings.points.push(data.points[i])
      }
    }else if(data.state === "image"){

      fetch(data.link)
      .then( response => response.blob() )
      .then( blob =>{
          var reader = new FileReader() ;
          reader.onload = function(){
            base64EncodedStr = this.result
            const array_location = [base64EncodedStr]
            
            for(let i = 0; i<data.location.length; i++){
              array_location.push(data.location[i])
            }

            // to create exact same form with we normally use
            const array = []
            array.push(data.state)
            array.push(array_location)
            array.push(data.configs)
          
            allDrawings.points.push(array)

            console.log("TOTALLY SAME DATA STRUCTURE")
            console.log(allDrawings)
            };
          reader.readAsDataURL(blob);
      }).catch(err => {})
      
    }else if(data.state === "end"){

      console.log("TOTALLY SAME DATA STRUCTURE")
      console.log(allDrawings)

      drawing.startIndex = data.startIndex

      designer.syncData(drawing)
      drawing.points = []
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

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  useEffect(() => {
    designer.addSyncListener(function (data) {
      if(data.points[data.points.length-1][0] === "image" || data.points[data.points.length-1][0] === "pdf"){

        

        
        // I send my data img to backend to upload it my S3bucket
        socket.emit("sendFile", data.points[data.points.length-1][1][0])

        // I get the link of the img that i sent before and i'm sending it to other users to use it
        socket.on("sendLinkImage", (link) => {
          sendMessage("drawing", {
            state: "image",
            link,
            location: data.points[data.points.length-1][1].splice(1,6),
            configs: data.points[data.points.length-1][2]
          }, 50000, meetingSession.audioVideo)
        })
        data.startIndex = startIndexStock
        startIndexStock = startIndexStock + 1
        
      }else{
        let chunkSize = 7
        let chunkNum = Math.ceil(data.points.length/chunkSize) 

        for(let i = 0; i < chunkNum; i++){
          let points = data.points.splice(0,chunkSize)

          for(let i = 0; i < points.length;  i++ ){
            allDrawings.points.push(points[i])
          }

          sendMessage("drawing", {
            state: "drawing",
            points,
          }, 50000, meetingSession.audioVideo)
          startIndexStock = data.startIndex
        }
      }

      sendMessage("drawing", {
        state: "end",
        startIndex: data.startIndex
      }, 50000, meetingSession.audioVideo)
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
    </div>
  );
}

export default App;
