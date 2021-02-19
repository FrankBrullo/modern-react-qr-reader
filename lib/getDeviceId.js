'use strict';

var _require = require('./errors'),
    NoVideoInputDevicesError = _require.NoVideoInputDevicesError;

function defaultDeviceIdChooser(filteredDevices, videoDevices, facingMode) {
  if (filteredDevices.length > 0) {
    var labelCompare = function labelCompare(a, b) {
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

  var videoDevicesLength = videoDevices.length;
  if (videoDevicesLength == 1 || facingMode == 'user') {
    return videoDevices[0].deviceId;
  }

  return videoDevicesLength > 0 ? videoDevices[videoDevicesLength - 1].deviceId : undefined;
}

var getFacingModePattern = function getFacingModePattern(facingMode) {
  return facingMode == 'environment' ? /rear|back|environment/i : /front|user|face/i;
};

function getDeviceId(facingMode) {
  var chooseDeviceId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultDeviceIdChooser;
  var cameraId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'camera2 0';

  var MAX_RETRIES = 5;
  var retriesCounter = 0;
  // Get manual deviceId from available devices.
  return new Promise(function (resolve, reject) {
    function loopCallback() {
      getDevices(facingMode, cameraId).then(function (response) {
        if (retriesCounter++ >= MAX_RETRIES || response.filteredDevices.length > 0 || response.videoDevices.length === 1) {
          resolve(chooseDeviceId(response.filteredDevices, response.videoDevices, facingMode));
        } else {
          setTimeout(loopCallback, 1000);
        }
      }).catch(function () {
        reject(new NoVideoInputDevicesError());
      });
    };

    loopCallback();
  });
}

function getDevices(facingMode, cameraId) {
  return new Promise(function (resolve, reject) {
    navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
      if (stream) {
        var streamTracks = stream.getTracks();
        streamTracks.forEach(function (streamTrack) {
          streamTrack.stop();
        });
      }

      var enumerateDevices = void 0;
      try {
        enumerateDevices = navigator.mediaDevices.enumerateDevices();
      } catch (err) {
        return reject();
      }

      enumerateDevices.then(function (devices) {
        // Filter out non-video inputs
        var videoDevices = devices.filter(function (device) {
          return device.kind == 'videoinput';
        });

        if (videoDevices.length < 1) {
          return reject();
        }

        var pattern = getFacingModePattern(facingMode);

        // Filter out video devices without the pattern
        var filteredDevices = videoDevices.filter(function (_ref) {
          var label = _ref.label;

          return pattern.test(label) && label.includes(cameraId);
        });

        return resolve({
          videoDevices: videoDevices,
          filteredDevices: filteredDevices
        });
      }).catch(function () {
        return reject();
      });
    });
  });
}

module.exports = { getDeviceId: getDeviceId, getFacingModePattern: getFacingModePattern };