$('#clickMore').on('click',function(){
    $('.face-detection').show();
    $('.buttonsArea').show();
});

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
    const displaySize = { width: document.getElementById('video').width, height: document.getElementById('video').height };
    faceapi.matchDimensions(document.getElementById('canvas'), displaySize);
    
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(document.getElementById('video'), new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptors().withFaceExpressions();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        document.getElementById('canvas').getContext('2d').clearRect(0, 0, document.getElementById('canvas').width, document.getElementById('canvas').height);

        faceapi.draw.drawDetections(document.getElementById('canvas'), resizedDetections);
        //faceapi.draw.drawFaceLandmarks(document.getElementById('canvas'), resizedDetections);                               //To draw facial landmarks
        isFaceDetected = detections.length > 0;
        if (!isFaceDetected) {
            showMessage("No Face Detected");
        } else {
          showMessage("Face Detected");
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
        $('#IDVerificationModal').hide();
        $('.buttonsArea').hide();
        $('#resultModal').modal('show');
        document.getElementById('matchMessage').textContent = matchResult;
        document.getElementById('matchRate').textContent = text;
        document.getElementById('matchRate').style.backgroundColor = bgColor;
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
