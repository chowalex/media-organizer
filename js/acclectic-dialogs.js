'use strict';
window.acclecticDialog = function (jq) {

  const PopupType = Object.freeze({ modal: 1, toast: 2, custom: 3 });

  return {
    getModal: getModal,
    getToast: getToast,
    getCustomPopup: getCustomPopup,
  };

  /**
   * Returns a modal popup. Call show() on the returned object to display the popup.
   * @param {dict} config Configuration parameters for the popup. 
   */
  function getModal(config) {
    return getPopup(PopupType.modal, config);
  }

  /**
   * Returns a toast notification popup. Call show() on the returned object to display the popup.
   * @param {dict} config Configuration parameters for the popup.
   */
  function getToast(config) {
    return getPopup(PopupType.toast, config);
  }

  /**
   * Returns a popup with custom HTML. Call show() on the returned object to display the popup.
   * @param {dict} config Configuration parameters for the popup.
   */
  function getCustomPopup(config) {
    return getPopup(PopupType.custom, config);
  }

  function getPopup(type, config) {
    let popup = {};
    let uuid = getUuid();
    let popupElement = getPopupElement(type, uuid, config);

    popup = {
      uuid: uuid,
      element: popupElement,
      show: show,
      hide: hide,
      update: update,
    }

    function show() {
      document.body.insertAdjacentElement('afterbegin', this.element);
      this.element.classList.add('active');
    }

    function hide() {
      this.element.classList.remove('active');
      this.element.remove();
    }

    function update(newConfig) {
      if (type !== PopupType.custom) {
        console.log('update() is only available for custom popups.');
        return;
      }
      this.element.innerHTML = newConfig.html;
    }

    return popup;
  }

  function getPopupElement(type, uuid, config) {
    switch (type) {
      case PopupType.modal:
        return getModalElement(uuid, config);
        break;
      case PopupType.toast:
        return getToastElement(uuid, config);
      case PopupType.custom:
        return getCustomElement(uuid, config);
      default:
        console.log("Unexpected popup type.");
        break;
    }
    return null;
  }

  function getModalElement(uuid, config) {
    let element = document.createElement('div');
    element.id = uuid;
    element.setAttribute('class', 'acclectic-modal');

    let titleElement = document.createElement('div');
    titleElement.setAttribute('class', 'acclectic-modal-title');
    titleElement.innerHTML = config.title;

    let descriptionElement = document.createElement('div');
    descriptionElement.setAttribute('class', 'acclectic-modal-description');
    descriptionElement.innerHTML = config.description;

    let headerElement = document.createElement('div');
    headerElement.setAttribute('class', 'acclectic-modal-header');
    headerElement.appendChild(titleElement);
    headerElement.appendChild(descriptionElement);

    let buttons = [];
    let buttonsElement = document.createElement('div');
    buttonsElement.setAttribute('class', 'acclectic-modal-buttons-section');
    if (config.buttons) {
      for (let i = 0; i < config.buttons.length; i++) {
        let buttonElement = document.createElement('a');
        buttonElement.id = 'acclectic-modal-button-' + i;
        buttonElement.setAttribute('href', '#');
        buttonElement.innerHTML = config.buttons[i].label;

        // If an onClick handler is provided, use it. Otherwise, dismiss popup by default.
        if (config.buttons[i].handler) {
          buttonElement.onclick = function () {
            config.buttons[i].handler();
            if (!config.buttons[i].keepOpen) {
              element.classList.remove('active'), element.remove();
            }
          }
        } else {
          if (!config.buttons[i].keepOpen) {
            buttonElement.onclick = function () { element.classList.remove('active'), element.remove(); }
          }
        }

        buttonsElement.appendChild(buttonElement);
        buttons.push(buttonElement);
      }
    }

    let wrapperElement = document.createElement('div');
    wrapperElement.setAttribute('class', 'acclectic-modal-wrapper');
    wrapperElement.appendChild(headerElement);
    wrapperElement.appendChild(buttonsElement);

    element.appendChild(wrapperElement);
    return element;
  }

  function getToastElement(uuid, config) {
    let element = document.createElement('div');
    element.id = uuid;
    element.setAttribute('class', 'acclectic-toast');

    let innerSpan = document.createElement('span');
    innerSpan.setAttribute('class', 'acclectic-toast-text');
    innerSpan.innerHTML = config.text;

    element.innerHTML = innerSpan.outerHTML;
    return element;
  }

  function getCustomElement(uuid, config) {
    let element = document.createElement('div');
    element.id = uuid;
    element.setAttribute('class', 'acclectic-custom-popup ' + config.class);
    element.innerHTML = config.html;
    return element;
  }

  // From https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
  function getUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}(jQuery);