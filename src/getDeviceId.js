const { NoVideoInputDevicesError } = require('./errors')

function defaultDeviceIdChooser(filteredDevices, videoDevices, facingMode) {
  if (filteredDevices.length > 0) {
    var labelCompare = (a, b)  => {
      if (a.label < b.label) {
        return -1;
      }
      if (a.label > b.label) {
        return 1;
      }
      return 0;
    };

    filteredDevices.sort(labelCompare);
    return filteredDevices[0].deviceId;
  }

  const videoDevicesLength = videoDevices.length;
  if (videoDevicesLength == 1 || facingMode == 'user') {
    return videoDevices[0].deviceId;
  }

  return videoDevicesLength > 0 ? videoDevices[videoDevicesLength - 1].deviceId : undefined;
}

const getFacingModePattern = (facingMode) => facingMode == 'environment'
  ? /rear|back|environment/i
  : /front|user|face/i

function getDeviceId(facingMode, chooseDeviceId = defaultDeviceIdChooser, cameraId='camera2 0') {
  const MAX_RETRIES = 5;
  let retriesCounter = 0;
  // Get manual deviceId from available devices.
  return new Promise(function (resolve, reject) {
      function loopCallback() {
        getDevices(facingMode, cameraId).then(function(response) {
          if ((retriesCounter++ >= MAX_RETRIES) ||
              (response.filteredDevices.length > 0) ||
              (response.videoDevices.length === 1)) {
            resolve(chooseDeviceId(response.filteredDevices, response.videoDevices, facingMode));
          } else {
            setTimeout(loopCallback, 1000);
          }
        }).catch(function() {
          reject(new NoVideoInputDevicesError());
        });
      };

      loopCallback();
  });
}

function getDevices(facingMode, cameraId) {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (stream) {
        const streamTracks = stream.getTracks();
        streamTracks.forEach((streamTrack) => {
          streamTrack.stop();
        });
      }

      let enumerateDevices;
      try {
        enumerateDevices = navigator.mediaDevices.enumerateDevices();
      } catch (err) {
        return reject();
      }

      enumerateDevices.then(devices => {
        // Filter out non-video inputs
        const videoDevices = devices.filter(
          device => device.kind == 'videoinput'
        )

        if (videoDevices.length < 1) {
          return reject();
        }

      const pattern = getFacingModePattern(facingMode);

      // Filter out video devices without the pattern
      const filteredDevices = videoDevices.filter(({ label }) =>{
        return pattern.test(label) && label.includes(cameraId);
      });

      return resolve({
        videoDevices: videoDevices,
        filteredDevices: filteredDevices
      });
    }).catch(() => {
        return reject();
      });
    });
  });
}

module.exports = { getDeviceId, getFacingModePattern }