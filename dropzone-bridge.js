// 
// This bridges dropzonejs.com, a multi-file uploader, with Knack
// 
// User declares what scene and view contains their file upload input
// button. They also have to declare what the field_id is that corresponds
// to the file. 
// 
// As soon as the user drags a file into the dropzone, the file upload will 
// commence. Form submission is disabled while files are still uploading. 
// Users can click cancel/remove on files in the dropzone and it will work as 
// expected. Form submission is re-enabled when all file uploads are finished
// or cancelled. 
//
// On form submission, this code overrides the submit button. For each file that 
// was previously uploaded, we create a Knack record. All other (non-file) form 
// values are submitted along with the file, so if you have a form with a file
// upload and other values, this will work as expected to set all values. If any
// error messages are returned for any record creation, typically from validation
// errors (e.g. you are missing a field, or a field has invalid data entered), the
// entire record creation will halt and display the errors using the normal Knack
// error messaging system. 
//
// There are a number of TODOs scattered throughout the code, any help is welcome in
// fixing these one by one. Most of these are fairly small TODOs, here are the bigger
// ones:  
//   - Assumption that there is only one file upload box per view
//   - TODO - test if this work with >1 upload box per scene (e.g. multiple views all with inputs)
//   - Using the Object API is insecure - it exposes your API key. It would be nice to remap this to the view API
// Minor todo - the record browser within the Knack builder shows all uploaded images as "broken thumbnail". Not sure what is wrong or what I need to fix

// The view you want to replace the file/image upload with a bulk
// file/image upload on
var BULK_VIEW = "view_34";

// The field within the view. This should be the file/image field
var BULK_VIEW_INPUT_FIELD = "field_20";

// In Data>Objects click on the object you want to upload. The 
// URL will have the ID of that object type
var OBJECT_ID = "object_3";

// Click on the individual fields to see their field IDs. This must
// be the ID of the Image or File you want to multi-upload
var OBJECT_FILE_FIELD_ID = "field_20";

// See https://www.knack.com/developer-documentation/#find-your-api-key-amp-application-id
// TODO stop using object API, use REST API instead
var KNACK_APP_ID = '<REPLACE>';
var KNACK_REST_API_KEY = '<REPLACE>';

var DZ_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/dropzone/5.7.2/min/dropzone.min.js';

$(document).on(`knack-view-render.${BULK_VIEW}`, function (event, view, data) {
  log('Detected render of ' + BULK_VIEW);

  // id=field_20_upload
  // As much as possible, we do not replace Knack UI elements. 
  // Instead, we update them to match our use case
  // This is more future-proof in case of Knack changes
  var $fileInputBtn=$(`#kn-input-${BULK_VIEW_INPUT_FIELD} input[type=file]`);
  var $formSubmitBtn = $(`#${BULK_VIEW} .kn-submit button[type=submit]`);

  // until init done, disable submit
  $formSubmitBtn.prop('disabled', true);

  LazyLoad.css('https://cdnjs.cloudflare.com/ajax/libs/dropzone/5.7.2/dropzone.min.css', function () {});
  LazyLoad.js([DZ_URL], function () {
    log("running initialize");
    initialize();
  });

  var knackHeaders = {
    'X-Knack-Application-ID': KNACK_APP_ID,
    'X-Knack-REST-API-Key': KNACK_REST_API_KEY
  };

  // log(JSON.stringify(view));
  // log(JSON.stringify(data));

  // TODO update name to name[]
  $fileInputBtn.prop("multiple", true);
  // TODO we should use classes, not ids, to avoid one-use-only
  $fileInputBtn.after(`<div id="dropzone-${BULK_VIEW_INPUT_FIELD}" class="dropzone dropzone-knack" />`);
  $fileInputBtn.hide();

  var $buFiledrag=$(`#filedrag-${BULK_VIEW_INPUT_FIELD}`);
  var $form = $(`#${BULK_VIEW} form`);
  var $formConfirmation = $(`#${BULK_VIEW} .kn-form-confirmation`);

  var files = [];

  function log(message) {
    console.log('Knack Bulk Upload: ' + message);
  }

  function initialize() {
    var upurl = `${Knack.api_url}/v1/applications/${KNACK_APP_ID}/assets/POST/upload`;

    // TODO read the input type and map it to DZ's acceptedFiles config so we only allow valid uploads
    var dz = new Dropzone(`div#dropzone-${BULK_VIEW_INPUT_FIELD}`, 
      { 
        url: upurl, 
        headers: knackHeaders, 
        paramName: 'files', 
        addRemoveLinks: true,
        dictDefaultMessage: '<div class="dz-message needsclick"><button type="button" class="dz-button">Drop files here or click to upload.</button><br></div>',
      });

    // Only allow submission when we are not actively processing images
    dz.on("addedfile", function(file) { $formSubmitBtn.prop('disabled', true); });
    dz.on("queuecomplete", function(file) { $formSubmitBtn.prop('disabled', false); });
    dz.on("removedfile", deleteFile);
    dz.on("success", function(file, responseText, e) {
      file['responseText'] = responseText;
      files.push(file);
   });

    $formSubmitBtn.on('click', handleFormSubmit);

    // init done, enable submit
    $formSubmitBtn.prop('disabled', false);
  }

  function deleteFile(removedFile) {
    // TODO actually delete files from s3 server

    // Update the files array
    files = files.filter(file => file.name != removedFile.name);
  }

  function allFilesHaveRecords() {
    for (file of files) {
      log('checking allFilesHaveRecords: ');
      console.log("  " + file['name']);
      if (!('knackRecordCreated' in file)) {
        log('  No record, returning false');
        return false;
      }
    }
    log('allFilesHaveRecords: return true');

    return true;
  }

  function showMessage(err, message) {
    log("Showing message: " + message);
    $formConfirmation.show();
    var clazz = err === true ? "is-error" : "success";
    $formConfirmation.append(`<div class="kn-message ${clazz}"><p>${message}</p></div>`);
    if (err === true) {
      $formConfirmation.find('.kn-form-reload').hide();
    } else {
      $formConfirmation.find('.kn-form-reload').show();
    }
  }

  function clearMessages() {
    // Form messages come from Knack JS - they know the form is still visible. form-confirm is used
    // when form might have been hidden
    $formConfirmation.find('.kn-message').remove();
    $form.find('.kn-message').remove();
    $formConfirmation.hide();
  }

  function handleFormSubmit(event) {
    // If we have created object records for all uploaded files, then 
    // we have nothing left to do. We return and allow the submit to be 
    // handled as expected
    if (allFilesHaveRecords()) {
      // TODO mark the form as finished & return;
    }

    if (files.length === 0) {
      // this method is all about creating records for uploaded files. If 
      // there are no uploaded files, then we do not need to interrupt the
      // form submission. Just returning allows the submit to proceed as normal
      // (e.g. this allows the files to be null)
      return;
    }

    log("Takeover form submission");

    
    // do not allow click to proceed, we will handle this submit and then 
    // retry when we are done
    event.preventDefault();

    // Show progress and prevent an impatient click
    // Knack.showSpinner();
    $formSubmitBtn.addClass("is-loading");
    $formSubmitBtn.prop('disabled', true); 

    // Grab all other data items from the form into a simple key-value object
    var formData = $form.serializeArray().reduce(function (output, value) {
        output[value.name] = value.value
        return output
    }, {});

    // TODO filter out files with record already created
      // if ('knackRecordCreated' in file) {
      //   log(file.name + " already has a record, skipping");
      //   return resolve("ok");
      // }

    var targetUrl = `${Knack.api_url}/v1/objects/${OBJECT_ID}/records`;

    const upload = file => new Promise((res, rej) => {
      log("Creating record for " + file.name);

      // Add the one file we are submitting to the existing form data
      formDataClone = { ...formData };
      formDataClone[OBJECT_FILE_FIELD_ID] = file.responseText.id;

      // No idea why $.post does not work, but whatevs
      var jqXHR = $.ajax({
        type: 'POST',
        url: targetUrl,
        headers: knackHeaders,
        data: formDataClone,
        }); 

      // Mark uploaded file with record created
      // TODO - should we just remove it from the dropzone? That might be 
      // simpler than maintaining a list in memory 
      jqXHR.done(() => {
        file['knackRecordCreated'] = true;
        res();
      });

      jqXHR.fail((xhr, textStatus, errorThrown) => {
            let json = JSON.parse(xhr.responseText);
            let errMsg = "Unknown Error";
            if (json && json.errors) {
              errMsg = json.errors.reduce((acc, cur) => acc + `<p>${cur.message}</p>`, "");
            }
            rej(errMsg);
      });
    });

    clearMessages();
    // TODO handle HTTP 429 events
    // TODO try #s > 2 to see how well it works
    asyncPool(2, files, upload)
      .then(() => { 
        console.log("success");
        $form.hide();
        showMessage(false, "Form submitted");
      })
      .catch((errors) => { 
        log("errors"); 
        console.log(errors);
        $formSubmitBtn.removeClass("is-loading");
        // todo
        showMessage(true, errors);
      });

  } // end handleFormSubmit


}); // End doc.on(knack-view-render)


function asyncPool(poolLimit, array, iteratorFn) {
  let i = 0;
  const ret = [];
  const executing = [];
  const enqueue = function() {
    if (i === array.length) {
      return Promise.resolve();
    }
    const item = array[i++];
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    let r = Promise.resolve();

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        r = Promise.race(executing);
      }
    }

    return r.then(() => enqueue());
  };
  return enqueue().then(() => Promise.all(ret));
}


