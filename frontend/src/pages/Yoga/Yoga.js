import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import React, { useRef, useState, useEffect } from 'react'
import backend from '@tensorflow/tfjs-backend-webgl'
import Webcam from 'react-webcam'
import { count } from '../../utils/music';
 
import Instructions from '../../components/Instrctions/Instructions';
import './Yoga.css'

import DropDown from '../../components/DropDown/DropDown';
import { poseImages } from '../../utils/pose_images';
import { POINTS, keypointConnections } from '../../utils/data';
import { drawPoint, drawSegment } from '../../utils/helper';
import { pushToCouchDB } from './handler.js';
import { publishKeypoints } from './pub.js';

let skeletonColor = 'rgb(255,255,255)'
let poseList = [
  'Tree', 'Chair', 'Cobra', 'Warrior', 'Dog',
  'Shoulderstand', 'Traingle'
]

let interval

let flag = false

function Yoga() {
  useEffect(() => {
    const initializeBackend = async () => {
      await tf.ready();
      await tf.setBackend('webgl');
    };
    initializeBackend();
  }, []);
  
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)

  const [startingTime, setStartingTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [poseTime, setPoseTime] = useState(0)
  const [bestPerform, setBestPerform] = useState(0)
  const [currentPose, setCurrentPose] = useState('Tree')
  const [isStartPose, setIsStartPose] = useState(false)
  
  // New state to store keypoints
  const [detectedKeypoints, setDetectedKeypoints] = useState([])

  useEffect(() => {
    const timeDiff = (currentTime - startingTime)/1000
    if(flag) {
      setPoseTime(timeDiff)
    }
    if((currentTime - startingTime)/1000 > bestPerform) {
      setBestPerform(timeDiff)
    }
  }, [currentTime])

  useEffect(() => {
    setCurrentTime(0)
    setPoseTime(0)
    setBestPerform(0)
  }, [currentPose])

  const CLASS_NO = {
    Chair: 0,
    Cobra: 1,
    Dog: 2,
    No_Pose: 3,
    Shoulderstand: 4,
    Traingle: 5,
    Tree: 6,
    Warrior: 7,
  }

  // Rest of the existing helper functions (get_center_point, get_pose_size, etc.)
  // ... (keep all previous helper functions)


  function get_center_point(landmarks, left_bodypart, right_bodypart) {
    let left = tf.gather(landmarks, left_bodypart, 1)
    let right = tf.gather(landmarks, right_bodypart, 1)
    const center = tf.add(tf.mul(left, 0.5), tf.mul(right, 0.5))
    return center
    
  }

  function get_pose_size(landmarks, torso_size_multiplier=2.5) {
    let hips_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    let shoulders_center = get_center_point(landmarks,POINTS.LEFT_SHOULDER, POINTS.RIGHT_SHOULDER)
    let torso_size = tf.norm(tf.sub(shoulders_center, hips_center))
    let pose_center_new = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    pose_center_new = tf.expandDims(pose_center_new, 1)

    pose_center_new = tf.broadcastTo(pose_center_new,
        [1, 17, 2]
      )
      // return: shape(17,2)
    let d = tf.gather(tf.sub(landmarks, pose_center_new), 0, 0)
    let max_dist = tf.max(tf.norm(d,'euclidean', 0))

    // normalize scale
    let pose_size = tf.maximum(tf.mul(torso_size, torso_size_multiplier), max_dist)
    return pose_size
  }

  function normalize_pose_landmarks(landmarks) {
    let pose_center = get_center_point(landmarks, POINTS.LEFT_HIP, POINTS.RIGHT_HIP)
    pose_center = tf.expandDims(pose_center, 1)
    pose_center = tf.broadcastTo(pose_center, 
        [1, 17, 2]
      )
    landmarks = tf.sub(landmarks, pose_center)

    let pose_size = get_pose_size(landmarks)
    landmarks = tf.div(landmarks, pose_size)
    return landmarks
  }

  function landmarks_to_embedding(landmarks) {
    // normalize landmarks 2D
    landmarks = normalize_pose_landmarks(tf.expandDims(landmarks, 0))
    let embedding = tf.reshape(landmarks, [1,34])
    return embedding
  }

  const modelRef = useRef(null);

  const loadModel = async () => {
    if (!modelRef.current) {
      try {
        modelRef.current = await tf.loadLayersModel('https://models.s3.jp-tok.cloud-object-storage.appdomain.cloud/model.json');
      } catch (error) {
        console.error('Error loading the pose classification model:', error);
        return null;
      }
    }
    return modelRef.current;
  };
  
  const runMovenet = async () => {
    const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER };
    const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
    const poseClassifier = await loadModel();
    if (!poseClassifier) return; // Stop if model loading fails
  
    const countAudio = new Audio(count);
    countAudio.loop = true;
  
    interval = setInterval(() => {
      detectPose(detector, poseClassifier, countAudio);
    }, 100);
  };
  
  const detectPose = async (detector, poseClassifier, countAudio) => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      let notDetected = 0 
      const video = webcamRef.current.video
      const pose = await detector.estimatePoses(video)
      const ctx = canvasRef.current.getContext('2d')
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      try {
        const keypoints = pose[0].keypoints 

        let input = keypoints.map((keypoint) => {
          const THRESHOLD = 0.4; // Adjust based on testing
          keypoint.status = keypoint.score > THRESHOLD ? 'Correct' : 'Wrong';
            //console.log(keypoint.status)
            // console.log(currentPose);
            // keypoint.yoga_type=currentPose;
            if(keypoint.score > 0.4) {
              if(!(keypoint.name === 'left_eye' || keypoint.name === 'right_eye')) {
                drawPoint(ctx, keypoint.x, keypoint.y, 8, 'rgb(255,255,255)')
                let connections = keypointConnections[keypoint.name]
                try {
                  connections.forEach((connection) => {
                    let conName = connection.toUpperCase()
                    drawSegment(ctx, [keypoint.x, keypoint.y],
                        [keypoints[POINTS[conName]].x,
                         keypoints[POINTS[conName]].y]
                    , skeletonColor)
                  })
  
                } catch(err) {
  
                }
                
              }
            } else {
              notDetected += 1
            } 
            return [keypoint.x, keypoint.y]
          }) 
        
        const formatKeypoints = (keypoints) => {
          return keypoints.map((keypoint) => ({
            name: keypoint.name,
            x: Math.round(keypoint.x),
            y: Math.round(keypoint.y),
            score: Math.round(keypoint.score * 100) / 100,
            status: keypoint.score > 0.5 ? 'Correct' : 'Wrong',
          }));
        };
        const formattedKeypoints = formatKeypoints(keypoints);
        //console.log(formattedKeypoints)
        
        // Update state with detected keypoints
        setDetectedKeypoints(formattedKeypoints);

        await pushToCouchDB({
          keypoints: formattedKeypoints,
          timestamp: new Date().toISOString(),
        });

        const mqttdata = formattedKeypoints.map(keypoint => ({
          name: keypoint.name,
          status: keypoint.status.toLowerCase()
        }));
        await publishKeypoints(mqttdata);
        


        if(notDetected > 4) {
          skeletonColor = 'rgb(255,255,255)'
          return
        }
        const processedInput = tf.tidy(() => landmarks_to_embedding(input));
        const classification = poseClassifier.predict(processedInput);
        processedInput.dispose(); // Explicitly dispose of unused tensors

        classification.array().then((data) => {         
          const classNo = CLASS_NO[currentPose]
          console.log(data[0][classNo])
          if(data[0][classNo] > 0.97) {
            
            if(!flag) {
              countAudio.play()
              setStartingTime(new Date(Date()).getTime())
              flag = true
            }
            setCurrentTime(new Date(Date()).getTime()) 
            skeletonColor = 'rgb(0,255,0)'
          } else {
            flag = false
            skeletonColor = 'rgb(255,255,255)'
            countAudio.pause()
            countAudio.currentTime = 0
          }
        })

        // Rest of the existing detection logic
        // ... (keep the rest of the detectPose function as it was)
      } catch(err) {
        console.log(err)
      }
    }
  }

  function startYoga(){
    if (interval) clearInterval(interval); // Clear any running intervals
    setIsStartPose(true) 
    runMovenet()
  } 

  function stopPose() {
    setIsStartPose(false)
    clearInterval(interval)
    // Clear keypoints when stopping
    setDetectedKeypoints([])
  }

  if(isStartPose) {
    return (
      <div className="yoga-container">
        <div className="performance-container">
          <div className="pose-performance">
            <h4>Pose Time: {poseTime} s</h4>
          </div>
          <div className="pose-performance">
            <h4>Best: {bestPerform} s</h4>
          </div>
        </div>
        <div>
          <Webcam 
            width='640px'
            height='480px'
            id="webcam"
            ref={webcamRef}
            style={{
              position: 'absolute',
              left: 120,
              top: 100,
              padding: '0px',
            }}
          />
          <canvas
            ref={canvasRef}
            id="my-canvas"
            width='640px'
            height='480px'
            style={{
              position: 'absolute',
              left: 120,
              top: 100,
              zIndex: 1
            }}
          >
          </canvas>
          <div>
            <img  
              src={poseImages[currentPose]} 
              className="pose-img" alt='img'
             /> 
          </div>
        </div>
        <div>

          
        </div>
        
        {/* Keypoints Display Section */}
        <div 
          style={{
            position: 'absolute', 
            right: 20, 
            top: 100, 
            width: '400px', 
            height: '700px', 
            overflowY: 'auto',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '8px'
          }}
        >
          <h3>Detected Keypoints</h3>
          {detectedKeypoints.length > 0 ? (
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
              <thead>
                <tr>
                  <th style={{border: '1px solid white', padding: '5px'}}>Name</th>
                  {/* <th style={{border: '1px solid white', padding: '5px'}}>X</th>
                  <th style={{border: '1px solid white', padding: '5px'}}>Y</th>
                  <th style={{border: '1px solid white', padding: '5px'}}>Yoga name</th>*/}
                  <th style={{border: '1px solid white', padding: '5px'}}>Status</th> 
                </tr>
              </thead>
              <tbody>
                {detectedKeypoints.map((keypoint, index) => (
                  <tr key={index}>
                    <td style={{border: '1px solid white', padding: '5px'}}>{keypoint.name}</td>
                    {/* <td style={{border: '1px solid white', padding: '5px'}}>{keypoint.x}</td>
                    <td style={{border: '1px solid white', padding: '5px'}}>{keypoint.y}</td>
                    <td style={{border: '1px solid white', padding: '5px'}}>{keypoint.yoga_type}</td>*/} 
                    <td style={{border: '1px solid white', padding: '5px'}}>{keypoint.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No keypoints detected</p>
          )}
        </div>
        
        <button
          onClick={stopPose}
          className="secondary-btn"    
        >Stop Pose</button>
      </div>
    )
  }

  return (
    <div className="yoga-container">
      <DropDown
        poseList={poseList}
        currentPose={currentPose}
        setCurrentPose={setCurrentPose}
      />
      <Instructions currentPose={currentPose} />
      <button
        onClick={startYoga}
        className="secondary-btn"    
      >Start Pose</button>
    </div>
  )
}

export default Yoga