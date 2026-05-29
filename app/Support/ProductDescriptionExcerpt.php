<?php

namespace App\Support;

class ProductDescriptionExcerpt
{
    /**
     * First paragraph of rich HTML for list cards: strips lists, returns first non-empty <p>.
     */
    public static function firstParagraph(?string $html): string
    {
        $html = trim((string) $html);
        if ($html === '') {
            return '';
        }

        $html = preg_replace('/<(ul|ol|dl)(\s[^>]*)?>[\s\S]*?<\/\1>/iu', ' ', $html) ?? $html;
        $html = preg_replace('/<li(\s[^>]*)?>[\s\S]*?<\/li>/iu', ' ', $html) ?? $html;

        if (preg_match_all('/<p\b[^>]*>([\s\S]*?)<\/p>/iu', $html, $matches)) {
            foreach ($matches[1] as $chunk) {
                $text = self::plainText($chunk);
                if ($text !== '') {
                    return $text;
                }
            }
        }

        return self::plainText($html);
    }

    public static function plainText(string $fragment): string
    {
        $text = html_entity_decode(strip_tags($fragment), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\xc2\xa0", ' ', $text);

        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }
}
