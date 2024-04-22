const video = document.getElementById('video');

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('models/tiny_face_detector_model-weights_manifest.json'),
    faceapi.nets.faceLandmark68Net.loadFromUri('models/face_landmark_68_model-weights_manifest.json'),
    faceapi.nets.faceRecognitionNet.loadFromUri('models/face_recognition_model-weights_manifest.json'),
    faceapi.nets.faceExpressionNet.loadFromUri('models/face_expression_model-weights_manifest.json'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('models/ssd_mobilenetv1_model-weights_manifest.json')
]).then(startVideo);

async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
             video: {
                facingMode: 'user'          //'environment' for back camera, 'user' for front camera
             } });
        document.getElementById('video').srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam", err);
    }
}
// Toggle between front and back cameras
async function toggleCamera() {
    const videoElement = document.getElementById('video');
    const stream = videoElement.srcObject;
    if (!stream) return;

    const tracks = stream.getTracks();
    for (const track of tracks) {
        track.stop();
    }

    const currentFacingMode = videoElement.srcObject.getVideoTracks()[0].getSettings().facingMode;
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: newFacingMode
            }
        });

        videoElement.srcObject = newStream;
    } catch (error) {
        console.error('Error toggling camera:', error);
    }
}

const flipCameraBtn = document.getElementById('flipCameraBtn');
if (flipCameraBtn) {
    flipCameraBtn.addEventListener('click', toggleCamera);
}
video.addEventListener('play', () => {
    // Variables to store previous texture analysis results
    
    let prevTextureAnalysisResults = null;//----------testing
    let prevLandmarks = null; //----------testing

    const displaySize = { width: document.getElementById('video').width, height: document.getElementById('video').height };
    faceapi.matchDimensions(document.getElementById('canvas'), displaySize);
    
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(document.getElementById('video'), new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptors().withFaceExpressions();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        document.getElementById('canvas').getContext('2d').clearRect(0, 0, document.getElementById('canvas').width, document.getElementById('canvas').height);

        faceapi.draw.drawDetections(document.getElementById('canvas'), resizedDetections);
        //To draw facial landmarks
        //faceapi.draw.drawFaceLandmarks(document.getElementById('canvas'), resizedDetections);                               
        isFaceDetected = detections.length > 0;
        if (!isFaceDetected) {
           //showMessage("No Face Detected");
        } else {
          //showMessage("Face Detected");
          const landmarks = resizedDetections[0].landmarks._positions;
          const textureAnalysisResults = extractTextureAnalysisResults(landmarks);
          
          // Perform liveness detection
          if (prevTextureAnalysisResults && prevLandmarks) {
            //console.log("texture " + textureAnalysisResults + "Prev texture " + prevTextureAnalysisResults + "landmarks " + landmarks + "Prev Landmarks " + prevLandmarks);
              const isLive = isPersonLive(textureAnalysisResults, prevTextureAnalysisResults, landmarks, prevLandmarks);
              if (isLive) {
                  //showMessage("Person is live");
              } else {
                  showMessage("Person is not live");
              }
          }
          
          // Update previous texture analysis results and landmarks
          prevTextureAnalysisResults = textureAnalysisResults;
          prevLandmarks = landmarks;
        }

    }, 100);
});


document.getElementById('captureBtn1').addEventListener('click', () => {
    captureImage(1);
});

document.getElementById('captureBtn2').addEventListener('click', () => {
    captureImage(2);
});

let capturedDetails;
let isFaceDetected = false;
let descriptors = { desc1: null, desc2: null };
const threshold = 0.6;


//Below method has been used for confirmatiobn and error message handling
function captureImage(imageNumber) {
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = document.getElementById('video').videoWidth;
    captureCanvas.height = document.getElementById('video').videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(document.getElementById('video'), 0, 0, captureCanvas.width, captureCanvas.height);

    faceapi.detectAllFaces(captureCanvas, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withFaceExpressions()
        .then(detections => {
            const resultElement = document.getElementById('result');

            if (detections.length > 1) {
                resultElement.textContent = `Multiple faces detected in Video`;
            } else if (detections.length === 1 && detections[0].landmarks) {
                console.log(`Captured Image${imageNumber} Details:`, detections);
                capturedDetails = detections;
                descriptors[`desc${imageNumber}`] = detections[0]?.descriptor; // Assuming there is only one face in the captured image
                
                if(imageNumber == 1){
                    $('.face-detection').hide();
                    $('.footer').hide();
                    $('#confirmationModal').modal('show');
                }
                else if(imageNumber == 2){
                    updateResult();
                }
            } else {
                resultElement.textContent = `Not able to detect face in Video`;
            }
        });
}

//After click on OK
$('#confirmAction').on('click',function(){
    $('.face-detection').show();
    $('#captureBtn1').hide();
    $('#captureBtn2').show();
    $('.captureImage1').hide();
    $('.captureImage2').show();
});

function updateResult() {
    if (descriptors.desc1 && descriptors.desc2) {
        const distance = faceapi.utils.round(faceapi.euclideanDistance(descriptors.desc1, descriptors.desc2));
        let text = distance;
        let bgColor = '#ffffff';
        let matchResult = '';

        if (distance > threshold) {
            text += ' (no match)';
            bgColor = '#ce7575';
            matchResult = 'Face Match Unsuccessful!!!';
        } else {
            text += ' (match)';
            bgColor = '#75ce75';
            matchResult = 'Face Match Successful!!!';
        }

        // document.getElementById('result').textContent = text;
        // document.getElementById('result').style.backgroundColor = bgColor;
        $('#resultModal').modal('show');
        document.getElementById('matchMessage').textContent = matchResult;
        document.getElementById('matchRate').textContent = text;
        document.getElementById('matchRate').style.backgroundColor = bgColor;
        $('.face-detection').hide();
        console.log(matchResult);
    }
}

function showMessage(msg) {
    document.getElementById('message').textContent = msg;
    document.getElementById('message').style.visibility = 'visible';
}

function hideMessage() {
    document.getElementById('message').style.visibility = 'hidden';
}

//--------------------------------------------------------------------------------------------------------------------
//#region Liveness Detection
function extractTextureAnalysisResults(landmarks) {
    const results = [];
    // Perform texture analysis for each landmark and store the results
    for (const landmark of landmarks) {
        // Perform your texture analysis here and push the result into the array
        const textureAnalysisResult = performTextureAnalysis(landmark);
        results.push(textureAnalysisResult);
    }
    return results;
}

// Function to perform simple texture analysis (you can replace this with your actual implementation)
function performTextureAnalysis(landmark) {
    return { x: landmark.x, y: landmark.y }; // Placeholder example, replace with actual analysis
}
function isPersonLive(currentResults, prevResults, currentLandmarks, prevLandmarks) {
    // Define thresholds for texture analysis and facial movement
    const textureThreshold = 10; // Adjust this value according to your requirements
    const movementThreshold = 5; // Adjust this value according to your requirements

    // Compare texture analysis results between current and previous frames
    for (let i = 0; i < currentResults.length; i++) {
        const currentResult = currentResults[i];
        const prevResult = prevResults[i];

        const textureDiff = Math.abs(currentResult.x - prevResult.x) + Math.abs(currentResult.y - prevResult.y);
        
        // If the texture difference exceeds the threshold, it may indicate that the person is not live
        if (textureDiff > textureThreshold) {
            return false; // Person is likely not live
        }
    }

    // Compare facial movement between current and previous frames
    for (let i = 0; i < currentLandmarks.length; i++) {
        const currentLandmark = currentLandmarks[i];
        const prevLandmark = prevLandmarks[i];

        const movementDiff = Math.abs(currentLandmark.x - prevLandmark.x) + Math.abs(currentLandmark.y - prevLandmark.y);

        // If the movement difference exceeds the threshold, it may indicate that the person is not live
        if (movementDiff > movementThreshold) {
            return false; // Person is likely not live
        }
    }

    // If both texture analysis and facial movement are within the thresholds, consider the person as live
    return true;
}

//#endregion 
//-------------------------------------------------------------------------------------------------------------------
//Below code can be used for uploaded images

        // uploadBtn.addEventListener('click', () => {
        //     const uploadedImage = fileInput.files[0];
        //     if (uploadedImage) {
        //         processUploadedImage(uploadedImage);
        //     } else {
        //         console.error('Please select an image to upload.');
        //     }
        // });

        // function processUploadedImage(uploadedImage) {
        //     const reader = new FileReader();
        //     reader.onload = function (e) {
        //         const img = new Image();
        //         img.src = e.target.result;

        //         img.onload = function () {
        //             const uploadCanvas = document.createElement('canvas');
        //             uploadCanvas.width = img.width;
        //             uploadCanvas.height = img.height;
        //             const ctx = uploadCanvas.getContext('2d');
        //             ctx.drawImage(img, 0, 0, uploadCanvas.width, uploadCanvas.height);
        //             console.log("Image Resolution" + uploadCanvas.width + "x" + uploadCanvas.height);
        //             if (uploadCanvas.width >= 400 && uploadCanvas.height >= 400) {
        //                 deferred.resolve(true);
        //             } else {
        //                 alert("The image resolution is too low.");
        //                 deferred.resolve(false);
        //             }
        //             debugger;
        //             faceapi.detectAllFaces(uploadCanvas, new faceapi.TinyFaceDetectorOptions())
        //                 .withFaceLandmarks()
        //                 .withFaceDescriptors()
        //                 .withFaceExpressions()
        //                 .then(detections => {
        //                     console.log('Uploaded Image Details:', detections);
        //                     descriptors.desc2 = detections[0]?.descriptor; // Assuming there is only one face in the uploaded image
        //                     updateResult();
        //                 });
        //         };
        //     };

        //     reader.readAsDataURL(uploadedImage);
        // }