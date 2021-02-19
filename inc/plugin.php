<?php
namespace Acclectic;

/**
 * Acclectic Media Organizer Module
 */
class MediaOrganizerPlugin
{

    public function __construct()
    {
        $this->init_files();
    }

    private function init_files()
    {
        include_once ACCLECTIC_PATH . 'inc/wp-helper.php';
        include_once ACCLECTIC_PATH . 'inc/strings.php';
        include_once ACCLECTIC_PATH . 'inc/control-panel.php';

        // Instantiate installed modules.
        ControlPanel::getInstance();
    }
}

new MediaOrganizerPlugin();
