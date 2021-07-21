<?php
/**
 * Plugin Name: Acclectic Media Organizer
 * Plugin URI:  https://www.acclectic.com/
 * Description: A media organizer that lets you categorize and group media files into virtual folders.
 * Version:     1.2
 * Author:      Acclectic Media
 * Author URI:  https://www.acclectic.com
 * Text Domain: acclectic-media-organizer
 * License:     GPL-2.0+
 * License URI: http://www.gnu.org/licenses/gpl-2.0.txt
 * Domain Path: /languages/
 */

namespace Acclectic;

if (!defined('ABSPATH')) {exit;}

define('ACCLECTIC__FILE__', __FILE__);
define('ACCLECTIC_PATH', plugin_dir_path(ACCLECTIC__FILE__));
define('ACCLECTIC_URL', plugins_url('/', ACCLECTIC__FILE__));

define('ACCLECTIC_TEXT_DOMAIN', 'acclectic-media-organizer');
define('ACCLECTIC_PLUGIN_BASE', plugin_basename(ACCLECTIC__FILE__));
define('ACCLECTIC_PLUGIN_NAME', 'Acclectic');

define('ACCLECTIC_JS_URL', ACCLECTIC_URL . 'js/');
define('ACCLECTIC_CSS_URL', ACCLECTIC_URL . 'css/');
define('ACCLECTIC_ASSETS_URL', ACCLECTIC_URL . 'assets/');
define('ACCLECTIC_THIRD_PARTY_URL', ACCLECTIC_URL . 'third_party/');

define('ACCLECTIC_FOLDERS_TABLE', 'sp_media_organizer_folders');
define('ACCLECTIC_ITEMS_TABLE', 'sp_media_organizer_items');

function acclectic_init()
{
    include_once ACCLECTIC_PATH . 'inc/plugin.php';

    loadAcclecticTextDomain();
}

function loadAcclecticTextDomain()
{
    $locale = function_exists('determine_locale') ?
    determine_locale() : (is_admin() ? get_user_locale() : get_locale());

    load_textdomain(ACCLECTIC_TEXT_DOMAIN, plugin_dir_path(__FILE__) . 'languages/' . $locale . '.mo');

    // Deprecated.
    load_plugin_textdomain(ACCLECTIC_TEXT_DOMAIN, false, plugin_dir_path(__FILE__) . 'languages/');
}

function activate()
{
    global $wpdb;

    $folder_table = $wpdb->prefix . ACCLECTIC_FOLDERS_TABLE;
    $items_table = $wpdb->prefix . ACCLECTIC_ITEMS_TABLE;

    if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $folder_table)) != $folder_table) {
        $cmd = 'CREATE TABLE ' . $folder_table . ' (
            `id` INT NOT NULL AUTO_INCREMENT,
            `node_id` VARCHAR(64) NOT NULL,
            `parent_id` VARCHAR(64) NOT NULL,
            `type` VARCHAR(64) NOT NULL,
            `name` VARCHAR(255) NOT NULL,
            `slug` VARCHAR(255) NOT NULL,
            `path` VARCHAR(255) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY `id` (id))
            ENGINE = InnoDB ' . $wpdb->get_charset_collate() . ';';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($cmd);
    }

    if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $items_table)) != $items_table) {
        $cmd = 'CREATE TABLE ' . $items_table . ' (
            `post_id` BIGINT(20) NOT NULL,
            `parent_id` VARCHAR(64) NOT NULL,
            PRIMARY KEY (post_id),
            UNIQUE KEY `post_id` (post_id))
            ENGINE = InnoDB ' . $wpdb->get_charset_collate() . ';';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($cmd);
    }
}

add_action('plugins_loaded', 'Acclectic\\acclectic_init');

register_activation_hook(__FILE__, 'Acclectic\\activate');

// TODO: Load classes so activate/deactivate can be done in another class.
// register_activation_hook(__FILE__, array('Acclectic\\AcclecticPlugin', 'activate'));
// register_deactivation_hook(__FILE__, array('Acclectic\\AcclecticPlugin', 'deactivate'));
