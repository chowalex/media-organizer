// Main JS implementation of the Media Organizer Module.

!function (jq) {

  const DEFAULT_NEW_FOLDER_ORDER = "first";
  const DEFAULT_NEW_FOLDER_TYPE = "default";

  const MEDIA_LIBRARY_FOLDER_FILTER_KEY = "MediaLibraryFolderFilter";
  const SELECTED_FOLDERID_COOKIE_KEY = "selectedFolderCookieKey";

  const ALL_FOLDER_ID = "all";
  const UNASSIGNED_FOLDER_ID = "unassigned";

  const DISABLE_ANIMATIONS = false;

  var config = acclecticMediaOrganizerConfig;
  var folders = [];
  var allItemCount = 0;
  var unassignedItemCount = 0;
  var selectedFolderId = ALL_FOLDER_ID;
  var editable = true;

  var defaultNewFolderName = '[' + i18n['newFolder'] + ']';

  var me = {
    jstreeUrl: config.thirdPartyPath + '/jstree',
    ajaxUrl: config.ajaxUrl,
    nonce: config.nonce,

    init: function () {
      this.setSelectedFolderFromUrl();
      this.setupMainPanelUi(editable);
      if (editable) {
        this.setupListDraggables();
        this.setupGridDraggables();
      }
      this.setupGridFilter();
      this.setupResizer();

      this.setupItemDeletionListener();
      this.setupItemUploadListener();
    },

    /**
     * Listen for delete-post AJAX events, to refresh folder tree after items are deleted.
     */
    setupItemDeletionListener: function () {
      jq(document).ajaxComplete(function (event, xhr, settings) {
        if ((settings.data.indexOf("action=delete-post") > -1)) {
          me.getFolderTree();
        }
      });
    },

    /**
     * Bind to uploader events to act when items are added.
     */
    setupItemUploadListener: function () {
      if (wp && typeof (wp.Uploader) == "function") {
        jq.extend(wp.Uploader.prototype, {
          init: function () {

            // Set the folder_id parameter as expected by PHP, and show toast notification.
            this.uploader.bind("BeforeUpload", function (uploader, file) {
              uploader.settings.multipart_params['folder_id'] = me.getSelectedFolder();
            });

            this.uploader.bind("FilesAdded", function (uploader, files) {
              uploadTracker.setup(config.assetsPath, me.getSelectedFolderName());
              uploadTracker.trackFiles(files);
            });

            this.uploader.bind("UploadProgress", function (uploader, file) {
              uploadTracker.trackFiles(file);
            });

            // Upon completion, update the folder tree and hide toast notification.
            this.uploader.bind("UploadComplete", function () {
              console.log("Upload complete");
              me.reloadGridItems(me.getSelectedFolder());
              me.getFolderTree();
            });
          }
        })
      }
    },

    /**
     * Sets up the main control panel UI.
     */
    setupMainPanelUi: function () {
      me.addControlPanelToUpload();

      // Get folders from server and instantiate folder tree.
      this.getFolderTree(true, true);

      // Set up top category cards.
      jq("#all_items_card").on("click", function () {
        // TODO: share with me.treeSelectNodeHandler(ALL_FOLDER_ID);
        me.setSelectedFolder(ALL_FOLDER_ID);
        console.log("UI selected node " + me.getSelectedFolder());
        me.reloadGridItems(me.getSelectedFolder());
        me.reloadList(me.getSelectedFolder());
        tree.get().deselect_all(true);
      });
      jq("#unassigned_items_card").on("click", function () {
        me.setSelectedFolder(UNASSIGNED_FOLDER_ID);
        console.log("UI selected node " + me.getSelectedFolder());
        me.reloadGridItems(me.getSelectedFolder());
        me.reloadList(me.getSelectedFolder());
        tree.get().deselect_all(true);
      });

      // Set up Add folder button.
      jq(".control-panel-header #header_action_add_folder a").on("click", function (a) {
        var newNode = tree.get().create_node(
          null,
          tree.getNode(
            null,
            null,
            defaultNewFolderName,
            DEFAULT_NEW_FOLDER_TYPE,
            0),
          DEFAULT_NEW_FOLDER_ORDER, false, false);
      })

    },

    /** Adds the control side panel to the upload page. */
    addControlPanelToUpload: function () {
      if (!jq("body").hasClass("upload-php")) return;

      var wpMediaSectionId = "#wpbody .wrap";
      jq(wpMediaSectionId).wrapAll('<div class="wrap-media-plus-control-panel"></div>');
      var sidebar_html = wp.element.renderToString(me.getControlPanel());
      sidebar_html += wp.element.renderToString(me.getSplitter());
      jq(wpMediaSectionId).before(sidebar_html);
    },

    getCard: function (id, className, countId, iconPath, label, count) {
      var iconElement = wp.element.createElement('img', { class: 'header-card-icon ' + className, src: iconPath });
      var labelElement = wp.element.createElement('span', { class: className + ' card-label' }, label);
      var countElement = wp.element.createElement('span', { class: className + ' card-count', id: countId }, count);
      var linkElement = wp.element.createElement(
        'a',
        { href: '#', id: id, class: className },
        iconElement, labelElement, countElement);
      return wp.element.createElement(
        'li',
        { class: className },
        wp.element.createElement('div', { class: className }, linkElement));
    },

    getButton: function (id, label, iconPath) {
      var iconElement = wp.element.createElement('img', { class: 'header-card-icon', src: iconPath });
      var labelElement = wp.element.createElement('span', null, label);
      return wp.element.createElement(
        'div',
        { class: 'header-action-button', id: id },
        wp.element.createElement('a', { href: '#' }, iconElement, labelElement));
    },

    getHeader: function (title, cards, buttons) {
      var titleSection = wp.element.createElement('div', { class: 'header-title' },
        wp.element.createElement('span', { class: 'header-label' }, title)
      );
      var cardsSection = wp.element.createElement(
        'div',
        { class: 'header-cards' },
        wp.element.createElement('ul', null, cards));
      var buttonsSection = wp.element.createElement(
        'div',
        { class: 'header-buttons' },
        buttons);
      return wp.element.createElement(
        'div',
        { class: 'control-panel-header' },
        titleSection, cardsSection, buttonsSection);
    },

    getControlPanel: function (showTitle = true, showButtons = true) {
      var cards = [];
      cards.push(me.getCard(
        'all_items_card',
        'media_organizer_all',
        'all-item-count',
        config.assetsPath + 'items_all.svg',
        i18n['allItems'],
        0
      ));
      cards.push(me.getCard(
        'unassigned_items_card',
        'media_organizer_unassigned',
        'unassigned-item-count',
        config.assetsPath + 'items_unassigned.svg',
        i18n['unassignedItems'],
        0
      ));

      var buttons = [];
      if (showButtons) {
        buttons.push(me.getButton(
          'header_action_add_folder',
          i18n['createFolder'],
          config.assetsPath + 'folder_add_light.svg'));
      }

      var header = me.getHeader(showTitle ? i18n['folders'] : null, cards, buttons);
      var folderTree = wp.element.createElement('div', { id: 'acclectic-jstree' });

      return wp.element.createElement('div', { class: 'control-panel-main' }, header, folderTree);
    },

    getSplitter: function () {
      var handle = wp.element.createElement(
        'img',
        { class: 'splitter-handle', src: config.assetsPath + 'resizer_handle.png' }
      );
      return wp.element.createElement('div', { class: 'splitter' }, handle);
    },

    setupModalUi: function (browser) {
      if (!me.isModal()) return;
      console.log("Setting up modal media UI");

      var frameMenu = browser.views.parent.views.get(".media-frame-menu");
      frameMenu[0].views.add(new wp.media.View({
        el: wp.element.renderToString(me.getControlPanel(false, false))
      }));

      editable = false;
      me.init();
      browser.views.parent.$el.removeClass("hide-menu");
    },

    /** Sets up the splitter to resize the control panel via the JQuery UI Resizable framework. */
    setupResizer: function () {
      // This must be explicitly disabled because it causes this error on any click:
      // Cannot read property 'ownerDocument' of undefined
      if (me.isModal()) return;

      jq(".control-panel-main").resizable({
        handles: { e: jq(".splitter") },
        minWidth: 200,
        ghost: true,
        animate: true
      });
    },

    /** Makes the given item draggable via the JQuery UI Draggable framework. */
    makeDraggable: function (item) {
      item.draggable({
        cursor: "move",
        revert: "invalid",
        revertDuration: 0,
        appendTo: "body",
        cursorAt: { top: 0, left: 0 },
        distance: 10,
        refreshPositions: !0,
        start: me.dragStarter,
        stop: function () { },
      });
    },

    /** Makes items in the media list view draggable. */
    setupListDraggables: function () {
      var listDraggables;

      if (config.mediaLibraryMode !== "list") {
        console.log("Not a list view. Returning.");
        return;
      }

      listDraggables = jq("#wpbody-content .wp-list-table tbody tr:not(.no-items)");
      me.makeDraggable(listDraggables);
    },

    /** Makes items in the media grid view draggable. */
    setupGridDraggables: function () {
      if (wp.media !== undefined && wp.media.view !== undefined) {
        var originalLibrary = wp.media.view.Attachment.Library;
        wp.media.view.Attachment.Library = wp.media.view.Attachment.Library.extend({
          initialize: function () {
            originalLibrary.prototype.initialize.apply(this, arguments);

            this.on("ready", function () {
              me.makeDraggable(this.$el);
            });
          },
        });
      }
    },

    /** Start handler to be called when a draggable item is dragged. Returns a drag tooltip. */
    dragStarter: function (e, data) {
      var selectedItems = [];
      if (me.isGrid() || me.isModal()) {
        selectedItems = me.getSelectedItemsInGrid(e);
      }
      else if (me.isList()) {
        selectedItems = me.getSelectedItemsInList(e);
      }

      console.log(selectedItems);
      var numSelected = selectedItems.length;

      // This returns false.
      return jq.vakata.dnd.start(e, {
        jstree: true,
        nodes: [{}],
        selectedItems: selectedItems.map(id => { return parseInt(id) || 0 }),
      },
        "<span>".concat(me.getDragText(numSelected)).concat("</span>")
      );
    },

    /**
     * Handles a drag-and-drop event when dragging stops and item is dropped.
     * @param {object} data 
     */
    handleDndStop: function (data) {
      var targetNode = tree.get().get_node(jq(data.event.target));

      // Change mouse pointer back to default.
      jq("html,body").css("cursor", "default");

      if (targetNode == null || !targetNode) {
        console.log("Drop target is outside of folder tree.");

        if (jq(data.event.target).attr('class') == undefined ||
          !jq(data.event.target).attr('class').includes('media_organizer_unassigned')) {
          console.log("Drop target is not unassigned folder either. Returning.");
          return;
        }

        console.log("Unassigning " + data.data.selectedItems.length + " items.");
        me.unassignMediaFolder(data.data.selectedItems);
        return;
      }

      if (data.data.selectedItems === undefined || data.data.selectedItems.length <= 0) {
        console.log("Cannot find selected items. Returning.");
        return;
      }
      me.assignMediaFolder(data.data.selectedItems, targetNode);
    },

    /** Returns true if this is a media list view. */
    isList: function () {
      return config.mediaLibraryMode == "list" && !this.isModal();
    },

    /** Returns true if this is a media grid view. */
    isGrid: function () {
      return (config.mediaLibraryMode == "grid") && !this.isModal();
    },

    /** Returns true if this is a media modal view. */
    isModal: function () {
      return (jq(".media-modal-content").size() > 0);
    },

    /**
     * Returns the selected items in grid view. This may be the item being dragged, or multiple 
     * items in select mode.
     * @param {object} event 
     */
    getSelectedItemsInGrid: function (event) {
      var inSelectMode = jq(".media-frame").hasClass("mode-select");

      var numSelected = 1;
      var selectedItems = [];
      var draggables = jq(".attachments .selected:not(.selection,:hidden)");

      // Get the dragged item by data-id.
      if ((config.mediaLibraryMode == "grid" && inSelectMode && draggables.length) ||
        (config.mediaLibraryMode == "modal" && draggables.length)) {
        numSelected = draggables.length;
        draggables.each(function (n, item) {
          selectedItems.push(jq(item).data("id"));
        });
      }
      else {
        selectedItems.push(jq(event.currentTarget).data("id"));
      }
      return selectedItems;
    },

    /**
     * Returns the selected items in list view, either one or more items selected via check-box,
     * or the item being dragged.
     * @param {object} event The event
     */
    getSelectedItemsInList: function (event) {
      var numSelected = 1;
      var selectedItems = [];
      var draggables = jq(".wp-list-table input[name='media[]']:input:checked");

      // If items are selected via check-box:
      if (draggables.length) {
        numSelected = draggables.length;
        draggables.each(function (n, item) {
          selectedItems.push(jq(item).val());
        });
      }
      // If no items are selected via check-box (and are being dragged instead):
      else {
        var regexMatch = jq(event.currentTarget)
          .attr("id")
          .match(/post-([0-9]{1,})/);
        selectedItems.push(regexMatch[1]);
      }
      return selectedItems;
    },

    /** Returns a tooltip indicating the number of items being moved/assigned. */
    getDragText: function (num) {
      var contentString = (parseInt(num) > 0) ? i18n['movingPluralItems'] : i18n['movingSingularItem'];
      tooltip = wp.element.createElement(DragTooltip, { contents: contentString, n: num }, null);
      return wp.element.renderToString(tooltip);
    },

    /** Sets the selected folder by getting the selection from the URL.  */
    setSelectedFolderFromUrl: function () {
      var selectedFolderFromUrl = me.getUrlParam("folder_id");
      me.setSelectedFolder(selectedFolderFromUrl != null ? selectedFolderFromUrl : ALL_FOLDER_ID);
    },

    /**
     * Sets the selected folder to the one with the given ID. Saves the selection to a cookie,
     * and highlights the selected folder in the top category cards.
     * @param {string} selectedFolder ID of the selected folder
     */
    setSelectedFolder: function (selectedFolder) {
      selectedFolderId = selectedFolder;
      me.setCookie(SELECTED_FOLDERID_COOKIE_KEY, selectedFolder);

      // Highlight the selected folder in the top category cards.
      // Folders in jstree are set to be selected on creation.
      jq("#all_items_card").removeClass("category_card_selected");
      jq("#unassigned_items_card").removeClass("category_card_selected");

      if (selectedFolder === ALL_FOLDER_ID) {
        jq("#all_items_card").addClass("category_card_selected");
      } else if (selectedFolder === UNASSIGNED_FOLDER_ID) {
        jq("#unassigned_items_card").addClass("category_card_selected");
      }
    },

    /** Sets a cookie with the given key and value. */
    setCookie: function (key, value) {
      document.cookie = key + "=" + encodeURIComponent(value);
    },

    /** Returns the value of the cookie with the given name. */
    getCookie: function (name) {
      var cookieArray = document.cookie.split(";");
      for (var i = 0; i < cookieArray.length; i++) {
        var cookiePair = cookieArray[i].split("=");
        if (name == cookiePair[0].trim()) {
          return decodeURIComponent(cookiePair[1]);
        }
      }
      return null;
    },

    /* Returns the value of the given URL parameter, or null if it does not exist. */
    getUrlParam: function (name) {
      const urlParams = new URLSearchParams(window.location.search);
      const folderId = urlParams.get(name);
      return folderId;
    },

    /** Returns the ID of the currently selected folder, or ALL_FOLDER_ID if none is selected. */
    getSelectedFolder: function () {
      return selectedFolderId != null ? selectedFolderId : ALL_FOLDER_ID;
    },

    /** Returns the human readable name of the selected folder. */
    getSelectedFolderName: function () {
      let selectedFolderId = me.getSelectedFolder();
      let selectedFolderName = i18n['allItems'];

      // Early exit.
      if (selectedFolderId == ALL_FOLDER_ID || selectedFolderId == UNASSIGNED_FOLDER_ID || !folders) {
        return selectedFolderName;
      }

      folders.forEach(function (f, index) {
        if (selectedFolderId === f.node_id) {
          selectedFolderName = f.name;
          return;
        }
      });
      return selectedFolderName;
    },

    /**
     * Gets the folder tree from the server and optionally creates or updates the tree UI.
     * @param {boolean} updateTreeUi if true, updates the tree UI
     * @param {boolean} newTreeUi if true && updateTreeUi, creates a new tree UI
     */
    getFolderTree: function (updateTreeUi = true, newTreeUi = false) {
      var request = {
        action: 'acclectic_get_media_folders',
        nonce: me.nonce,
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on getFolderTree.");
          return;
        }

        // response.data.folders contains the list of folders, or [] if none.
        if (response.data.folders === undefined) {
          console.log("Folders undefined. This shouldn't happen.");
          return;
        }

        folders = response.data.folders;

        allItemCount = response.data.all_item_count;
        unassignedItemCount = response.data.unassigned_item_count;
        if (updateTreeUi) {
          tree.loadUi(newTreeUi);
        }
        me.reloadGridFilters();
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Unassigns the given items by removing them from their parent folder.
     * @param {array} selectedItems An array of IDs of the selected items
     */
    unassignMediaFolder: function (selectedItems) {
      console.log("Unassigning " + selectedItems.toString() + ".");

      var request = {
        action: 'acclectic_unassign_media_folder',
        nonce: me.nonce,
        post_ids: selectedItems
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on unassign.");
          return;
        }

        if (response.data.unassigned) {
          console.log("Number of items unassigned: " + response.data.unassigned);
          // TODO: Efficiency improvement: remove items instead of reloading the page.

          // Selection normally triggers refresh, but not here because we select the same folder.
          me.reloadGridItems(me.getSelectedFolder());
          me.reloadList(me.getSelectedFolder());

          // In list mode, the page is refreshed anyway so we need not reload the tree.
          if (config.mediaLibraryMode != "list") {
            me.getFolderTree(true, false);
          }
        }
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Assigns the given items to the given target folder.
     * @param {array} selectedItems An array of IDs of the selected items
     * @param {object} targetNode The jstree node object of the target folder
     */
    assignMediaFolder: function (selectedItems, targetNode) {
      console.log("Assigning " + selectedItems.toString() + " to folder with node ID " + targetNode.id);

      var request = {
        action: 'acclectic_assign_media_folder',
        nonce: me.nonce,
        post_ids: selectedItems,
        parent_id: targetNode.id,
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on assign.");
          return;
        }

        if (response.data.assigned) {
          console.log("Number of items assigned: " + response.data.assigned);
          // TODO: Efficiency improvement: remove items instead of reloading the page.

          // Selection normally triggers refresh, but not here because we select the same folder.
          me.reloadGridItems(me.getSelectedFolder());
          me.reloadList(me.getSelectedFolder());

          // In list mode, the page is refreshed anyway so we need not reload the tree.
          if (config.mediaLibraryMode != "list") {
            me.getFolderTree(true, false);
          }
        }
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Reload items in list view to show only those in the given folder. This refreshes the entire page.
     * @param {string} selectedNode The ID of the folder of items to display
     */
    reloadList: function (selectedNode) {
      // If selectedNode is undefined, <select> would return the current value.
      if (selectedNode === undefined) {
        console.log("Undefined selection.");
        return;
      }
      if (!me.isList()) return;

      jq("#media-folder-filter-list option").remove();
      jq("#media-folder-filter-list").append("<option value=\"" + selectedNode + "\">" + selectedNode + "</option>");
      jq("#posts-filter").find('select[name="folder_id"]').val(selectedNode).change();
      jq("#posts-filter").submit();
    },

    /** Refreshes the underlying attachment filter in the media backbone in grid view. */
    reloadGridFilters: function () {
      jq(".attachments-browser").each(function () {
        jq(this).data("backboneView").toolbar.get(MEDIA_LIBRARY_FOLDER_FILTER_KEY).createFilters();
      });
    },

    /**
     * Reload items in grid view to show only those in the given folder.
     * @param {string} selectedNode The ID of the folder of items to display
     */
    reloadGridItems: function (selectedNode) {
      // If selectedNode is undefined, <select> would return the current value.
      if (selectedNode === undefined) {
        console.log("Undefined selection.");
        return;
      }
      if (!me.isGrid() && !me.isModal()) return;

      jq(".attachments-browser").each(function () {
        // Since we are using the select element only dynamically and invisibly, we set it to have one option for the 
        // selection, and select it.
        var selectElement = jq(this).data("backboneView").toolbar.get(MEDIA_LIBRARY_FOLDER_FILTER_KEY).$el;
        selectElement.empty();
        selectElement.append(new Option(selectedNode, selectedNode));
        selectElement.val(selectedNode).change();

        // See: https://wordpress.stackexchange.com/questions/78230/trigger-refresh-for-new-media-manager-in-3-5
        if (wp.media.frame.content.get() !== null && wp.media.frame.content.get().collection) {
          wp.media.frame.content.get().collection._requery(true);
          wp.media.frame.content.get().options.selection.reset();
        } else {
          wp.media.frame.library.props.set({ ignore: (+ new Date()) });
        }
      });
    },

    /** Sets up the folder filter in media grid view. */
    setupGridFilter: function () {
      if (
        wp.media === undefined ||
        wp.media.view === undefined ||
        wp.media.view.AttachmentFilters === undefined) {
        return;
      }

      // Extend and override the grid view filter.
      var MediaLibraryFolderFilter = wp.media.view.AttachmentFilters.extend({
        id: 'media-folder-filter-list',

        createFilters: function () {
          var filters = {};

          // index = array index. value = folder ID.
          _.each(folders || {}, function (value, index) {
            var folderId = value.node_id;
            filters[folderId] = {
              text: value.name,
              props: {
                folder_id: folderId,
              }
            };
          });
          filters.unassigned = {
            text: 'Unassigned',
            props: {
              folder_id: UNASSIGNED_FOLDER_ID,
            },
            priority: 10
          };
          filters.all = {
            text: 'All folders',
            props: {
              folder_id: ALL_FOLDER_ID,
            },
            priority: 10
          };

          this.filters = filters;
          this.listenTo(this.model, "change", this.select);
          this.select();
        }
      });

      // Extend and override wp.media.view.AttachmentsBrowser to include new filter.
      var attachmentsBrowser = wp.media.view.AttachmentsBrowser;
      wp.media.view.AttachmentsBrowser = wp.media.view.AttachmentsBrowser.extend({
        createToolbar: function () {
          console.log("Extending AttachmentsBrowser and creating toolbar.");

          // Set the backbone view.
          this.$el.data("backboneView", this);

          var filter = new MediaLibraryFolderFilter({
            controller: this.controller,
            model: this.collection.props,
            priority: -75
          }).render();

          // Load the original toolbar.
          attachmentsBrowser.prototype.createToolbar.call(this);
          this.toolbar.set(MEDIA_LIBRARY_FOLDER_FILTER_KEY, filter);
          filter.initialize();
        },

        ready: function () {
          console.log("Extended AttachmentsBrowser ready.");
          attachmentsBrowser.prototype.ready.call(this);
          me.setupModalUi(this);
        }
      });
    },
  };

  var tree = {

    // Configs for jstree plugins.

    dndConfig: {
      large_drop_target: true,
      large_drag_target: true,
      copy: false,
      drag_check: function (data) {
        return false;
      }
    },

    contextMenuConfig: {
      show_at_node: false,
      select_node: false, // Do not select node with context menu, since selection refreshes the page.
      items: function (o, cb) {
        return {
          "create": {
            "separator_before": false,
            "separator_after": true,
            "_disabled": false,
            "icon": me.jstreeUrl + '/themes/acclectic/folder_add_dark.svg',
            "label": i18n['createFolder'],
            "action": function (data) {
              tree.get().create_node(
                tree.get().get_node(data.reference),
                tree.getNode(null, null, defaultNewFolderName, DEFAULT_NEW_FOLDER_TYPE, 0),
                DEFAULT_NEW_FOLDER_ORDER, function (new_node) { }
              );
            }
          },
          "rename": {
            "separator_before": false,
            "separator_after": false,
            "_disabled": false,
            "icon": me.jstreeUrl + '/themes/acclectic/folder_edit.svg',
            "label": i18n['renameFolder'],
            "action": function (data) {
              tree.get().edit(tree.get().get_node(data.reference));
            }
          },
          "remove": {
            "separator_before": false,
            "icon": false,
            "separator_after": false,
            "_disabled": false,
            "icon": me.jstreeUrl + '/themes/acclectic/folder_delete.svg',
            "label": i18n['deleteFolder'],
            "action": function (data) {
              var folderNameToDelete = tree.get().get_node(data.reference).text;

              acclecticDialog.getModal({
                title: i18n['deleteFolderTitle'].formatUnicorn({ f: folderNameToDelete }),
                description: i18n['deleteFolderDescription'],
                buttons: [
                  { label: i18n['ok'], handler: function () { tree.deleteFolder(data); } },
                  { label: i18n['cancel'] }
                ],
              }).show();
            }
          },
        };
      }
    },

    nodeCustomizeConfig: {
      default: function (el, node) {
        var spanInner = node.li_attr["num_children"];
        var spanOuter = "<span class=\"jstree-child-count\">" + spanInner + "</span>";

        // An el of a parent node can contain many matches, so use children() instead of find().
        jq(el).children('a').append(spanOuter);
      }
    },

    /** Returns the instance of the jstree. */
    get: function () {
      return jq("#acclectic-jstree").jstree(true);
    },

    /**
     * Loads the folder tree UI.
     * @param {boolean} newTreeUi if true, creates a new tree
     */
    loadUi: function (newTreeUi) {
      var treeData = [];

      treeData = folders.map(dbFolder => tree.getNode(
        dbFolder['node_id'],
        dbFolder['parent_id'],
        dbFolder['name'],
        dbFolder['type'],
        dbFolder['num_children']
      ));

      if (newTreeUi) {
        tree.setupNewTree(treeData);
      } else {
        tree.refreshTree(treeData);
      }

      jq("#all-item-count").html(allItemCount);
      jq("#unassigned-item-count").html(unassignedItemCount);
    },

    refreshTree: function (treeData) {
      jq('#acclectic-jstree').jstree(true).settings.core.data = treeData;
      jq('#acclectic-jstree').jstree(true).refresh();
    },

    myPlugins: editable
      ? ["wholerow", "dnd", "contextmenu", "types", "node_customize", "sort"]
      : ["wholerow", "types", "node_customize"],

    setupNewTree: function (treeData) {
      jq("#acclectic-jstree").jstree({
        "plugins": tree.myPlugins,
        dnd: tree.dndConfig,
        contextmenu: tree.contextMenuConfig,
        node_customize: tree.nodeCustomizeConfig,
        'types': {
          'default': {
            'icon': me.jstreeUrl + '/themes/acclectic/folder-36px.png',
          },
        },
        'core': {
          "themes": {
            "name": "acclectic",
            "dots": false, // dots is not available with wholerow.
            "icons": true,
            responsive: false
          },
          li_height: 36,
          check_callback: true,
          'data': treeData,
        }
      });

      jq("#acclectic-jstree").on('init.jstree', function (e, data) {
        console.log("Folder tree initialized.");
      });
      jq("#acclectic-jstree").on('loaded.jstree', function (e, data) {
        console.log("Folder tree loaded.");
      });
      jq("#acclectic-jstree").on('ready.jstree', function (e, data) {
        console.log("Folder tree ready.");
      });
      jq("#acclectic-jstree").on('copy_node.jstree', function (e, data) { });
      jq("#acclectic-jstree").on('drop-finish', function (e, data) { });
      jq("#acclectic-jstree").on('create_node.jstree', tree.createNodeHandler);
      jq("#acclectic-jstree").on('rename_node.jstree', tree.updateNodeHandler);
      jq("#acclectic-jstree").on('move_node.jstree', tree.updateNodeHandler);
      jq("#acclectic-jstree").on('delete_node.jstree', tree.deleteNodeHandler);
      jq("#acclectic-jstree").on('select_node.jstree', tree.selectNodeHandler);
    },

    /**
     * Returns a jstree node.
     * @param {string} id The node, auto-generated if null
     * @param {string} parent The parent's node ID, set to root (#) if null
     * @param {string} text The display text (folder name)
     * @param {string} type The type, defaults to 'default'
     * @param {int} num_children The number of children
     */
    getNode: function (id, parent, text, type, num_children) {
      var nodeData = {};
      id != null && (nodeData['id'] = id);
      parent != null && (nodeData['parent'] = parent);
      nodeData['text'] = text;
      nodeData['type'] = type;
      nodeData['state'] = { selected: id === me.getSelectedFolder() };
      nodeData['li_attr'] = { "num_children": num_children };
      return nodeData;
    },

    /**
     * Callback after creation of a node in the jstree.
     * @param {event} e 
     * @param {object} data 
     */
    createNodeHandler: function (e, data) {
      console.log("UI created node " + data.node.id);

      var request = {
        action: 'acclectic_add_media_folder',
        nonce: me.nonce,

        id: data.node.id,
        parent: data.node.parent,
        text: data.node.text,
        type: data.node.type,
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on create node.");
          return;
        }

        if (response.data.added) {
          tree.get().edit(tree.get().get_node(response.data.node_id));

          // Grid Filters are updated post-editing via getFolderTree.
          // getFolderTree will update folders and call reloadGridFilters.
        }
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Callback after update of a node in the jstree.
     * @param {event} e 
     * @param {object} data 
     */
    updateNodeHandler: function (e, data) {
      console.log("UI updated node " + data.node.id);

      var request = {
        action: 'acclectic_update_media_folder',
        nonce: me.nonce,

        id: data.node.id,
        parent: data.node.parent,
        text: data.node.text,
        type: data.node.type,
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on update node.");
          return;
        }

        if (response.data.updated) {
          // This updates folders and calls reloadGridFilters. This is needed to:
          // 1. Update the grid filters after node creation (which launches edit);
          // 2. Update the folders var with edited info (optional but better for consistency).

          // TODO: To avoid another server call, the server can return folders in this response.
          me.getFolderTree(false, false);
        }
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Callback after deletion of a node in the jstree.
     * @param {event} e 
     * @param {object} data 
     */
    deleteNodeHandler: function (e, data) {
      console.log("UI deleted node " + data.node.id);

      var request = {
        action: 'acclectic_delete_media_folder',
        nonce: me.nonce,
        id: data.node.id,
      };

      var handler = function (response) {
        if (!response.success) {
          console.log("Error on delete node.");
          return;
        }

        if (response.data.updated) {
          me.reloadGridItems(me.getSelectedFolder());
          me.reloadList(me.getSelectedFolder());

          // In list mode, the page is refreshed anyway so we need not reload the tree.
          if (config.mediaLibraryMode != "list") {
            me.getFolderTree(true, false);
          }
        }
      };

      ajaxHelpers.submitRequest(request, handler);
    },

    /**
     * Callback after selection of a node in the jstree.
     * @param {event} e 
     * @param {object} data 
     */
    selectNodeHandler: function (e, data) {
      me.setSelectedFolder(data.node.id);
      console.log("UI selected node " + me.getSelectedFolder());
      me.reloadGridItems(me.getSelectedFolder());
      me.reloadList(me.getSelectedFolder());
    },

    /** Deletes a folder node from the tree. */
    deleteFolder: function (data) {
      tree.get().delete_node(tree.get().get_node(data.reference));
    },
  };

  var ajaxHelpers = {

    /**
     * Submits a request to the server and returns results via the given callback.
     * @param {object} request The request object
     * @param {object} successHandler A callback to handle a successful response
     */
    submitRequest: function (request, successHandler) {
      jq.ajax({
        type: "POST",
        url: me.ajaxUrl,
        cache: false,
        data: request,
        success: successHandler,
        error: ajaxHelpers.defaultErrorHandler,
      });
    },

    /** A default error handler. */
    defaultErrorHandler: function (e, status, error) {
      acclecticDialog.show({
        title: i18n['internalError'],
        description: i18n['contactCustomerService'],
        buttons: [{ label: i18n['ok'] }],
      });
      var httpStatus = e.status + ":" + e.statusText;
      console.log("Status: " + httpStatus + "\nError:\n" + error);
    },
  };

  jq(document).ready(function () {
    console.log("Document ready.");
    me.init()

    if (DISABLE_ANIMATIONS) {
      jq.fx.off = true;
    }
  })

  // Handler for dnd events onto jstree.
  jq(document).bind("dnd_stop.vakata", function (e, data) {
    me.handleDndStop(data);
  });

  /**
   * A React component that renders a tooltip when dragging an item. Contents of the tooltip 
   * may be parameterized.
   */
  class DragTooltip extends React.Component {
    render() {
      var innerContents = '';

      if (this.props.contents) {
        innerContents = this.props.contents.formatUnicorn(this.props);
      }

      return React.createElement('div', { class: 'acclectic-drag-tooltip' }, innerContents);
    }
  }

}(jQuery);

// From StackExchange.
String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
  function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
      var t = typeof arguments[0];
      var key;
      var args = ("string" === t || "number" === t) ?
        Array.prototype.slice.call(arguments)
        : arguments[0];

      for (key in args) {
        str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
      }
    }

    return str;
  };   