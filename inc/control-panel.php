<?php
namespace Acclectic;

define('ACCLECTIC_DEBUG_LOG', false);

// These constants must be consistent with JS usage.
define('ACCLECTIC_PARAM_FOLDER_ID', 'folder_id');
define('ACCLECTIC_PARAM_ALL_FOLDER_ID', 'all');
define('ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID', 'unassigned');
define('ACCLECTIC_PARAM_SELECT_ELEMENT_ID', 'media-folder-filter-list');

/**
 * A control panel for the media organizer module. This is a singleton class.
 */
class ControlPanel
{

    protected static $instance = null;

    private $folders_table;
    private $items_table;

    /**
     * Returns the singleton instance of the control panel.
     */
    public static function getInstance()
    {
        if (self::$instance == null) {
            self::$instance = new self;
        }
        return self::$instance;
    }

    private function __construct()
    {
        global $wpdb;

        $this->folders_table = $wpdb->prefix . ACCLECTIC_FOLDERS_TABLE;
        $this->items_table = $wpdb->prefix . ACCLECTIC_ITEMS_TABLE;

        add_action('admin_enqueue_scripts', array($this, 'enqueueStyles'));
        add_action('admin_enqueue_scripts', array($this, 'enqueueScripts'));

        // AJAX handlers.
        add_action('wp_ajax_acclectic_add_media_folder', array($this, 'addMediaFolder'));
        add_action('wp_ajax_acclectic_update_media_folder', array($this, 'updateMediaFolder'));
        add_action('wp_ajax_acclectic_delete_media_folder', array($this, 'deleteMediaFolder'));
        add_action('wp_ajax_acclectic_get_media_folders', array($this, 'getMediaFolders'));
        add_action('wp_ajax_acclectic_assign_media_folder', array($this, 'assignMediaFolder'));
        add_action('wp_ajax_acclectic_unassign_media_folder', array($this, 'unassignMediaFolder'));

        // Activate JS callbacks when items are added or deleted.
        add_action('add_attachment', array($this, 'itemAddedCallback'));
        add_action('delete_attachment', array($this, 'itemDeletedCallback'));

        // Folder filtering in Grid mode.
        add_filter('ajax_query_attachments_args', array($this, 'addFilterByFolderIdForGrid'), 20);
        // Folder filtering in List mode.
        add_filter('posts_clauses', array($this, 'addFilterByFolderIdForList'), 10/* priority */, 2/* num args */);
        add_filter('restrict_manage_posts', array($this, 'addFolderFilterUiForList'));
    }

    public function enqueueStyles()
    {
        wp_enqueue_style(
            'media-organizer-css',
            ACCLECTIC_CSS_URL . 'media-organizer.css',
            array(),
            ACCLECTIC_PLUGIN_NAME,
            'all');
        wp_enqueue_style(
            'acclectic-dialogs-css',
            ACCLECTIC_CSS_URL . 'acclectic-dialogs.css',
            array(),
            ACCLECTIC_PLUGIN_NAME,
            'all');
        wp_enqueue_style(
            'acclectic-jstree-css',
            ACCLECTIC_THIRD_PARTY_URL . 'jstree/themes/acclectic/style.css',
            array(),
            ACCLECTIC_PLUGIN_NAME,
            'all');
    }

    public function enqueueScripts()
    {
        wp_register_script(
            'acclectic-jstree',
            ACCLECTIC_THIRD_PARTY_URL . 'jstree/jstree.js',
            ['jquery'],
            ACCLECTIC_PLUGIN_NAME,
            false/* in_footer */);
        wp_register_script(
            'acclectic-jstree-plugins',
            ACCLECTIC_THIRD_PARTY_URL . 'jstree/misc.js',
            ['jquery'],
            ACCLECTIC_PLUGIN_NAME,
            false/* in_footer */);
        wp_register_script(
            'acclectic-dialogs',
            ACCLECTIC_JS_URL . 'acclectic-dialogs.js',
            ['jquery', 'wp-element'],
            ACCLECTIC_PLUGIN_NAME,
            false/* in_footer */);
        wp_register_script(
            'acclectic-media-organizer-main',
            ACCLECTIC_JS_URL . 'media-organizer-main.js',
            ['jquery', 'wp-element'],
            ACCLECTIC_PLUGIN_NAME,
            false/* in_footer */);

        wp_localize_script(
            'acclectic-media-organizer-main',
            'acclecticMediaOrganizerConfig',
            [
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('ajax-nonce'),
                'basePath' => ACCLECTIC_URL,
                'modulePath' => ACCLECTIC_URL . 'inc',
                'thirdPartyPath' => ACCLECTIC_THIRD_PARTY_URL,
                'assetsPath' => ACCLECTIC_ASSETS_URL,
                'mediaLibraryMode' => get_user_option('media_library_mode', get_current_user_id()),
            ]
        );

        wp_localize_script(
            'acclectic-media-organizer-main',
            'i18n',
            Strings::get()
        );

        wp_enqueue_script('jquery-ui-resizable');
        wp_enqueue_script('jquery-ui-draggable');
        wp_enqueue_script('jquery-ui-droppable');

        wp_enqueue_script('acclectic-jstree');
        wp_enqueue_script('acclectic-jstree-plugins');
        wp_enqueue_script('acclectic-dialogs');
        wp_enqueue_script('acclectic-media-organizer-main');
    }

    /**
     * AJAX callback to add a folder.
     */
    public function addMediaFolder()
    {
        global $wpdb;

        // sanitize_text_field returns "" if not found.
        $node_id = sanitize_text_field($_POST["id"]);
        $parent_id = sanitize_text_field($_POST["parent"]);
        $name = sanitize_text_field($_POST["text"]);
        $type = sanitize_text_field($_POST["type"]);

        $result = $wpdb->insert(
            $this->folders_table,
            array(
                'node_id' => $node_id,
                'parent_id' => $parent_id,
                'name' => $name,
                'type' => $type,
                'slug' => "slug",
                'path' => "path",
            )
        );

        $resultsArray = array(
            'added' => $result,
            'node_id' => $node_id,
        );

        // Calls JS success with success field = true.
        wp_send_json_success($resultsArray);
    }

    /**
     * AJAX callback to update a folder.
     */
    public function updateMediaFolder()
    {
        global $wpdb;

        $node_id = sanitize_text_field($_POST["id"]);
        $parent_id = sanitize_text_field($_POST["parent"]);
        $name = sanitize_text_field($_POST["text"]);
        $type = sanitize_text_field($_POST["type"]);

        $result = $wpdb->update(
            $this->folders_table,
            array(
                'node_id' => $node_id,
                'parent_id' => $parent_id,
                'name' => $name,
                'type' => $type,
            ), // Data to update
            array('node_id' => $node_id) // Where
        );

        $resultsArray = array(
            'updated' => $result,
            'node_id' => $node_id,
        );

        wp_send_json_success($resultsArray);
    }

    /**
     * AJAX callback to delete a folder.
     */
    public function deleteMediaFolder()
    {
        $node_id = sanitize_text_field($_POST["id"]);

        $result = self::deleteFolderWithChildren($node_id);

        $resultsArray = array(
            'updated' => $result,
            'node_id' => $node_id,
        );

        wp_send_json_success($resultsArray);
    }

    /**
     * AJAX callback to get all folders.
     */
    public function getMediaFolders()
    {
        global $wpdb;

        $sql_string =
            'SELECT f.*, (SELECT COUNT(1) FROM `%1$s` i WHERE i.parent_id = f.node_id) AS num_children FROM `%2$s` f';
        $results = $wpdb->get_results(
            $wpdb->prepare(
                $sql_string,
                $this->items_table,
                $this->folders_table
            ));

        $resultsArray = array(
            'folders' => $results,
            'all_item_count' => $this->getAllItemCount(),
            'unassigned_item_count' => $this->getUnassignedItemCount(),
        );

        wp_send_json_success($resultsArray);
    }

    /**
     * AJAX callback to assign a folder to items (move items to a folder).
     */
    public function assignMediaFolder()
    {
        $post_ids = $_POST["post_ids"];
        $parent_id = sanitize_text_field($_POST["parent_id"]);

        $resultsArray = $this->assignFolderToItems($post_ids, $parent_id);
        wp_send_json_success($resultsArray);
    }

    private function assignFolderToItems($post_ids, $parent_id)
    {
        global $wpdb;

        $new_records = array();

        foreach ($post_ids as $post_id) {
            array_push($new_records, array(
                'post_id' => (int) $post_id,
                'parent_id' => $parent_id,
            ));
        }

        $result = WpHelper::wp_insert_rows($new_records, $this->items_table, true/* update if exists*/);

        return array('assigned' => $result);
    }

    /**
     * AJAX callback to unassign a folder on items (remove items from folder).
     */
    public function unassignMediaFolder()
    {
        $post_ids = $_POST["post_ids"];

        $resultsArray = $this->unassignFolderFromItems($post_ids);
        wp_send_json_success($resultsArray);
    }

    private function unassignFolderFromItems($post_ids)
    {
        global $wpdb;
        $post_ids_string = implode(',', array_map('absint', $post_ids));
        $result = $wpdb->query(
            $wpdb->prepare(
                'DELETE FROM `%1$s` WHERE post_id IN (' . $post_ids_string . ')',
                $this->items_table
            ));

        return array('unassigned' => $result);
    }

    /**
     * Outputs a select UI element for filtering by folder in List view. This should be called by restrict_manage_posts.
     */
    public function addFolderFilterUiForList()
    {
        if (get_current_screen()->base !== 'upload') {
            return;
        }
        // TODO: change this id and pass to JS. It uses it too.
        // name=folder_id is passed as a URL parameter by wp.
        echo sprintf(
            '<select id="%s" class="attachment-filters" name="%s" />',
            ACCLECTIC_PARAM_SELECT_ELEMENT_ID,
            ACCLECTIC_PARAM_FOLDER_ID);
    }

    /**
     * Adds filtering by media folder ID to post clauses for List view.
     */
    public function addFilterByFolderIdForList($clauses, $query)
    {
        if ($query->get("post_type") !== "attachment") {
            return $clauses;
        }

        if (isset($_GET[ACCLECTIC_PARAM_FOLDER_ID]) || !empty($query->get(ACCLECTIC_PARAM_FOLDER_ID))) {

            $show_folder_id = isset($_GET[ACCLECTIC_PARAM_FOLDER_ID])
            ? sanitize_text_field($_GET[ACCLECTIC_PARAM_FOLDER_ID]) : $query->get(ACCLECTIC_PARAM_FOLDER_ID);

            if ($show_folder_id == ACCLECTIC_PARAM_ALL_FOLDER_ID) {
                return $clauses;
            }

            $posts = ($show_folder_id == ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID) ?
            $this->getUnassignedItemsFromDb() : $this->getItemsInFolderFromDb($show_folder_id);

            // Always add a placeholder ID if no matches are found. This forces query to return no matches.
            $posts += array(-1);
            $imploded_post_ids = implode(',', $posts);

            if ($show_folder_id == ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID) {
                $clauses['where'] .= "AND ID NOT IN (" . $imploded_post_ids . ")";
            } else {
                $clauses['where'] .= "AND ID IN (" . $imploded_post_ids . ")";
            }

        }
        return $clauses;
    }

    /**
     * Returns an attachments query with a filter for a certain folder_id.
     */
    public function addFilterByFolderIdForGrid($query)
    {
        if (!isset($_REQUEST['query'][ACCLECTIC_PARAM_FOLDER_ID])) {
            return $query;
        }

        $show_folder_id = $_REQUEST['query'][ACCLECTIC_PARAM_FOLDER_ID];

        if (!isset($query['post__not_in'])) {
            $query['post__not_in'] = array();
        }
        if (!isset($query['post__in'])) {
            $query['post__in'] = array();
        }

        $posts_in = array();
        $posts_not_in = array();

        if ($show_folder_id == ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID) {
            $posts_not_in = $this->getUnassignedItemsFromDb();
        } else {
            $posts_in = $this->getItemsInFolderFromDb($show_folder_id);
        }

        // Passing an empty array to post__in returns all results.
        // If there are no results, add a non-existent post ID.
        if ($show_folder_id != ACCLECTIC_PARAM_ALL_FOLDER_ID
            && $show_folder_id != ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID
            && count($posts_in) == 0) {
            $posts_in += array(-1);
        }

        $query['post__in'] += $posts_in;
        $query['post__not_in'] += $posts_not_in;

        if (ACCLECTIC_DEBUG_LOG) {
            error_log($sql);
            error_log(print_r($query, true));
        }

        return $query;
    }

    /**
     * Called after an attachment is added with the given ID. This function also expects a folder_id parameter
     * which is populated by the uploader as part of uploader.settings.multipart_params.
     */
    public function itemAddedCallback($post_id)
    {
        $folder_id = isset($_REQUEST[ACCLECTIC_PARAM_FOLDER_ID])
        ? sanitize_text_field($_REQUEST[ACCLECTIC_PARAM_FOLDER_ID]) : '';

        if ($folder_id == '' ||
            $folder_id == ACCLECTIC_PARAM_ALL_FOLDER_ID ||
            $folder_id == ACCLECTIC_PARAM_UNASSIGNED_FOLDER_ID) {
            return;
        }
        $items = array($post_id);
        $this->assignFolderToItems($items, $folder_id);
    }

    /**
     * Called after an attachment with the given ID is deleted.
     */
    public function itemDeletedCallback($post_id)
    {
        $this->unassignFolderFromItems(array($post_id));
    }

    private function getItemsInFolderFromDb($show_folder_id)
    {
        global $wpdb;
        return $wpdb->get_col($wpdb->prepare(
            'SELECT * FROM `%1$s` WHERE `parent_id` LIKE "%2$s"', $this->items_table, $show_folder_id));
    }

    private function getUnassignedItemsFromDb()
    {
        global $wpdb;
        return $wpdb->get_col($wpdb->prepare('SELECT * FROM `%1$s`', $this->items_table));
    }

    /**
     * Deletes the folder with the given folder ID and all of its children.
     * Child folders are deleted. Child items become unassigned.
     */
    private function deleteFolderWithChildren($folder_id)
    {
        global $wpdb;

        // Delete this folder.
        $result = $wpdb->delete(
            $this->folders_table,
            array('node_id' => $folder_id) // Where
        );

        // Delete child items in this folder.
        $wpdb->delete($this->items_table, array('parent_id' => $folder_id), array('%s'));

        // Recursively delete child folders.
        $child_folders = $wpdb->get_col(
            $wpdb->prepare(
                'SELECT `node_id` FROM `%1$s` WHERE `parent_id` LIKE "%2$s"', $this->folders_table, $folder_id
            ));
        foreach ($child_folders as $child_folder) {
            self::deleteFolderWithChildren($child_folder);
        }

        return $result;
    }

    /**
     * Returns the number of unassigned media items.
     */
    public function getUnassignedItemCount()
    {
        global $wpdb;
        $sql_string = 'SELECT COUNT(1) FROM `%1$s`';
        $assigned_count = $wpdb->get_var($wpdb->prepare($sql_string, $this->items_table));
        return $this->getAllItemCount() - $assigned_count;
    }

    /**
     * Returns the total number of media items.
     */
    public function getAllItemCount()
    {
        return wp_count_posts('attachment')->inherit;
    }

}
