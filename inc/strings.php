<?php
namespace Acclectic;

/**
 * Acclectic Media Organizer Module
 */
class Strings
{
    public static function get()
    {
        return array(
            'folders' => __('Folders', ACCLECTIC_TEXT_DOMAIN),
            'createFolder' => __('Create Folder', ACCLECTIC_TEXT_DOMAIN),
            'renameFolder' => __('Rename Folder', ACCLECTIC_TEXT_DOMAIN),
            'deleteFolder' => __('Delete Folder', ACCLECTIC_TEXT_DOMAIN),
            'allItems' => __('All Items', ACCLECTIC_TEXT_DOMAIN),
            'unassignedItems' => __('Unassigned Items', ACCLECTIC_TEXT_DOMAIN),
            'newFolder' => __('New Folder', ACCLECTIC_TEXT_DOMAIN),
            'movingSingularItem' => __('Moving one item', ACCLECTIC_TEXT_DOMAIN),
            'movingPluralItems' => __('Moving {n} items', ACCLECTIC_TEXT_DOMAIN),
            'ok' => __('OK', ACCLECTIC_TEXT_DOMAIN),
            'cancel' => __('Cancel', ACCLECTIC_TEXT_DOMAIN),
            'deleteFolderTitle' => __('Delete Folder {f}?', ACCLECTIC_TEXT_DOMAIN),
            'deleteFolderDescription' => __('Any subfolders will also be deleted, and all items in this folder and its subfolders will become unassigned.', ACCLECTIC_TEXT_DOMAIN),
            'uploading' => __('Uploading...', ACCLECTIC_TEXT_DOMAIN),
            'internalError' => __('Internal Error', ACCLECTIC_TEXT_DOMAIN),
            'contactCustomerService' => __('Please contact customer service if this issue persists.', ACCLECTIC_TEXT_DOMAIN),
        );
    }
}
