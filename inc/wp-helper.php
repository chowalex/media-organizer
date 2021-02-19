<?php
namespace Acclectic;

if (!defined('ABSPATH')) {exit;}

/**
 * A class that provides helper functions for Wordpress features.
 */
class WpHelper
{

    /**
     * Inserts one or more rows to the given table. Slightly modified from:
     * https://github.com/mirzazeyrek/wordpress-multiple-insert/blob/master/wp_insert_rows.php
     */
    public static function wp_insert_rows($row_arrays, $wp_table_name, $update = false, $primary_key = null)
    {
        global $wpdb;
        $wp_table_name = esc_sql($wp_table_name);
        $values = array();
        $place_holders = array();
        $query = "";
        $query_columns = "";

        $query .= "INSERT INTO `{$wp_table_name}` (";
        foreach ($row_arrays as $count => $row_array) {
            foreach ($row_array as $key => $value) {
                if ($count == 0) {
                    if ($query_columns) {
                        $query_columns .= ", " . $key . "";
                    } else {
                        $query_columns .= "" . $key . "";
                    }
                }

                $values[] = $value;

                $symbol = "%s";
                if (is_numeric($value)) {
                    if (is_float($value)) {
                        $symbol = "%f";
                    } else {
                        $symbol = "%d";
                    }
                }
                if (isset($place_holders[$count])) {
                    $place_holders[$count] .= ", '$symbol'";
                } else {
                    $place_holders[$count] = "( '$symbol'";
                }
            }

            $place_holders[$count] .= ")";
        }

        $query .= " $query_columns ) VALUES ";

        $query .= implode(', ', $place_holders);

        if ($update) {
            $update = " ON DUPLICATE KEY UPDATE ";
            $cnt = 0;
            foreach ($row_arrays[0] as $key => $value) {
                if ($cnt == 0) {
                    $update .= "$key=VALUES($key)";
                    $cnt = 1;
                } else {
                    $update .= ", $key=VALUES($key)";
                }
            }
            $query .= $update;
        }

        return $wpdb->query($wpdb->prepare($query, $values));
    }

    public static function sanitize_array($input)
    {
        if (is_array($input)) {
            return array_map('self::sanitize_array', $input);
        } else {
            return sanitize_text_field($input);
        }
    }
}
