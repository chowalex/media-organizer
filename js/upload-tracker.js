'use strict';
window.uploadTracker = function (jq) {

  class FileStatusProgressBar extends React.Component {
    render() {
      var width = this.props.percent + '%';
      var filledBar = wp.element.createElement(
        'div',
        { id: this.props.id, class: 'acclectic-uploader-progress-bar-filled', style: 'width: ' + width });
      return wp.element.createElement('div', { class: 'acclectic-uploader-progress-bar-background' }, filledBar);
    }
  }

  /**
   * A React component that renders a file upload status. Expects properties: 
   * * id: The uploader ID of the file
   * * filename: The name of the file
   * * filesize: A human-readable string of the file size (e.g. 56kB)
   * * percent: An integer representing the percentage complete (e.g. 20)
   */
  class FileStatus extends React.Component {
    render() {
      var percentDone = parseInt(this.props.percent) || 0;
      var iconFile = 'uploader-uploading.svg';
      if (percentDone >= 100) {
        iconFile = 'uploader-done.svg';
      }
      var fileText = '';
      if (this.props.filename) {
        fileText += this.props.filename;
      }
      if (this.props.filesize) {
        fileText += ' ' + this.props.filesize;
      }

      var icon = wp.element.createElement(
        'img',
        { class: 'acclectic-uploader-file-icon', src: config.assetsPath + iconFile });
      var progressBar = wp.element.createElement(FileStatusProgressBar, { percent: percentDone });
      var textStatus = wp.element.createElement('div', { class: 'acclectic-uploader-file-text' }, fileText);
      return wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-file-line', id: this.props.id },
        icon, progressBar, textStatus
      );
    }
  }

  /**
   * A React component that renders an upload header with title and close button. Expects properties:
   * * folder: The name of the destination folder
   */
  class UploadStatusHeader extends React.Component {
    render() {
      var folder = this.props.folder || 'All Items';

      var titleDiv = wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-header-title' },
        'Uploading to ' + folder);
      var closeIcon = wp.element.createElement(
        'a', { class: 'acclectic-uploader-close-button', href: '#' },
        wp.element.createElement('img', { src: config.assetsPath + 'close-24px.svg' }));

      return wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-header' },
        closeIcon, titleDiv);
    }
  }

  /**
   * A React component that renders a combined upload status bar. Expects properties:
   * * files_done: The number of files done
   * * total_files: The total number of files
   * * percent: An integer representing the total percentage complete (e.g. 20)
   */
  class UploadStatusHeaderStats extends React.Component {
    render() {
      var percentDone = parseInt(this.props.percent) || 0;
      var filesDone = parseInt(this.props.files_done) || 0;
      var totalFiles = parseInt(this.props.total_files) || 0;

      var progressBar = wp.element.createElement(FileStatusProgressBar, { percent: percentDone });
      var statusDiv = wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-header-status' },
        filesDone + ' of ' + totalFiles + ' done.');

      return wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-header-stats' },
        statusDiv, progressBar);
    }
  }

  var popup = null;

  /** Configuration parameters. */
  var config = {
    assetsPath: '',
    folderName: ''
  }

  /** Tracking stats across all files. */
  var stats = {
    filesDone: 0,
    totalFiles: 0,
    bytesDone: 0,
    totalBytes: 0
  };

  /** A dictionary of files, keyed by ID, from the WP media uploader. */
  var rawFiles = {};

  return {
    setup: setup,
    trackFiles: trackFiles,
    updateFile: updateFile
  };

  /**
   * Sets up the upload tracker with the given parameters.
   * @param {string} assetsPath The path to the assets folder containing tracker icons
   * @param {string} selectedFolderName The selected folder name to display
   */
  function setup(assetsPath, selectedFolderName) {
    if (assetsPath && !(assetsPath === '')) {
      config.assetsPath = assetsPath;
    }
    if (selectedFolderName && !(selectedFolderName === '')) {
      config.folderName = selectedFolderName;
    }
  }

  /**
   * Adds the given files to the tracker and shows or updates the upload status dialog. This 
   * should be called on FilesAdded (with an array of files) or UploadProgress (with one file).
   * @param {array | object} files The file or array of files from the WP uploader.
   */
  function trackFiles(files) {
    addFilesToTracker(files);
    computeStats();
    showDialog();
  }

  function updateFile(file) {
    addFilesToTracker(file); // This will replace existing file entry in the map.
    computeStats();

    var lineQuery = '#' + file.id + '.acclectic-uploader-file-line';
    var newHtml = wp.element.renderToString(getFileStatus(file));
    jQuery(lineQuery).replaceWith(newHtml);

    updateHeader();
  }

  function updateHeader() {
    var headerQuery = '.acclectic-uploader-header-stats';
    var newHtml = wp.element.renderToString(getHeaderStats());
    jQuery(headerQuery).replaceWith(newHtml);
  }

  /** Shows a dialog if it does not already exist. If one exists, content of the existing dialog will be updated. */
  function showDialog() {
    if (popup == null) {
      popup = acclecticDialog.getCustomPopup({
        class: 'acclectic-upload-dialog',
        html: '',
      });
    }
    setContentAndShow(getUploaderHtml());
  };

  function setContentAndShow() {
    if (popup == null) return;

    popup.update({
      html: getUploaderHtml()
    });

    popup.show();

    jq(".acclectic-uploader-header .acclectic-uploader-close-button").on("click", function (e) {
      e.preventDefault();
      closePopup();
    });
  };

  function closePopup() {
    resetTrackers();
    popup.hide();
    popup = null;
    rawFiles = {};
  };

  function resetTrackers() {
    stats = {
      filesDone: 0,
      totalFiles: 0,
      bytesDone: 0,
      totalBytes: 0
    };
  };

  function addFilesToTracker(uploaderFiles) {
    var fileArray = [];
    if (!Array.isArray(uploaderFiles)) {
      fileArray.push(uploaderFiles);
    } else {
      fileArray = uploaderFiles;
    }

    fileArray.forEach(function (f, index) {
      rawFiles[f.id] = f;
    });
  };

  function computeStats() {
    resetTrackers();

    for (var fileId in rawFiles) {
      var file = rawFiles[fileId];
      var fileBytes = parseInt(file.size) || 0;
      var filePercent = parseInt(file.percent) || 0;

      stats.totalFiles += 1;
      stats.totalBytes += fileBytes;

      stats.bytesDone += Math.round(fileBytes * filePercent / 100);
      if (filePercent >= 100) {
        stats.filesDone += 1;
      }
    }
  };

  function fileSizeIEC(a, b, c, d, e) {
    return (b = Math, c = b.log, d = 1024, e = c(a) / c(d) | 0, a / b.pow(d, e)).toFixed(0)
      + ' ' + (e ? 'KMGTPEZY'[--e] + 'B' : 'Bytes')
  };

  function getHeader() {
    return wp.element.createElement('div', {}, getHeaderTitle(), getHeaderStats());
  };

  function getHeaderTitle() {
    return wp.element.createElement(UploadStatusHeader, {
      folder: config.folderName
    });
  }

  function getHeaderStats() {
    return wp.element.createElement(UploadStatusHeaderStats, {
      percent: Math.round(stats.filesDone / stats.totalFiles * 100),
      files_done: stats.filesDone,
      total_files: stats.totalFiles,
    });
  }

  function getFileStatus(fileDict) {
    return wp.element.createElement(FileStatus, {
      id: fileDict.id,
      filename: fileDict.name,
      filesize: fileSizeIEC(fileDict.size),
      percent: fileDict.percent
    });
  };

  function getAllFileStatus() {
    var allFileStatusElements = [];

    for (var fileId in rawFiles) {
      var fileDict = rawFiles[fileId];
      allFileStatusElements.push(getFileStatus(fileDict));
    }

    return wp.element.createElement(
      'div',
      { class: 'acclectic-uploader-all-files' },
      allFileStatusElements);
  };

  function getUploaderHtml() {
    return wp.element.renderToString(
      wp.element.createElement(
        'div',
        { class: 'acclectic-uploader-content' },
        getHeader(), getAllFileStatus()
      )
    );
  };


}(jQuery);