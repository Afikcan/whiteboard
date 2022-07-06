import './App.css';
import io from "socket.io-client"
import CanvasDesigner from "./whiteboard"
import {useEffect, useState} from 'react'
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
export let meetingSession
let observer

const socket = io.connect("http://localhost:3001")

var designer = new CanvasDesigner();
designer.widgetHtmlURL = 'https://www.webrtc-experiment.com/Canvas-Designer/widget.html';
designer.widgetJsURL = 'https://www.webrtc-experiment.com/Canvas-Designer/widget.js';

//yarattığım whiteboard objesini yarattığım div'e eklemek için
designer.appendTo(document.getElementById('whiteboard-frame') || document.documentElement);

let drawing_data = {
  topic: "drawing",
  data: {

  }
}

function App() {
  const [meetingResponse, setMeetingResponse] = useState({})
  const [attendeeResponse, setAttendeeResponse] = useState({})
  

  const receiveDataMessageHandler = (data) =>{
    console.log("realtimeSubscribeToReceiveDataMessage")
    data = JSON.parse(new TextDecoder().decode(data.data))
    console.log(data)
    designer.syncData(data)
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
    socket.on("sendConfigs", (data) => {
      setAttendeeResponse(data.attendeeResponse) 
      setMeetingResponse(data.meetingResponse)

      console.log("Sent the configs")
      console.log("DATA:")
      console.log(meetingResponse)
      console.log(attendeeResponse)
    })
    main()
    console.log("After configs are sent")
    console.log(meetingResponse)
    console.log(attendeeResponse)
  })

  let main = async() => {
    console.log("After we got in main")
    console.log(attendeeResponse)

    logger = new ConsoleLogger('MyLogger', LogLevel.INFO);
    //console.log('-----------logger-----------')
    //console.log(logger)

    deviceController = new DefaultDeviceController(logger);
    //console.log('-----------deviceController-----------')
    //console.log(deviceController)

    configuration = new MeetingSessionConfiguration(meetingResponse, attendeeResponse);

    // In the usage examples below, you will use this meetingSession object.
    meetingSession = new DefaultMeetingSession(
      configuration,
      logger,
      deviceController
    );
    console.log("MEETINGSESSION")
    console.log(typeof(meetingSession.audioVideo))
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


    //sendMessage("chit-chat", 'hi mate', 50000)
    //getMessage('chit-chat', meetingSession.audioVideo)
    
    /*
    var paramsListAttendees = {
      MeetingId: meetingResponse.Meeting.MeetingId, 
      MaxResults: '5',
    };*/
    //socket.emit("listAttendees", paramsListAttendees)
  }



  return (
    <div className="App">
      <h1>Mounted</h1>
      <button onClick={() => {
        sendMessage(drawing_data.topic,  JSON.stringify(drawing_data), 50000, meetingSession.audioVideo)
      }}>SEND A MESSAGE</button>
      <button onClick={() => {
          getMessage(drawing_data.topic, meetingSession.audioVideo)
      }}>GET A MESSAGE</button>
    </div>
  );
}

export default App;
