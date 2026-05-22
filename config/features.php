<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Feature flags
    |--------------------------------------------------------------------------
    |
    | Toggleable feature flags driven by .env. Defaults are intentionally
    | conservative so that flipping a single env value falls back to the
    | previous behavior immediately.
    |
    */

    /*
     * Which design version to render for the public Product QR enquiry page.
     * 'v1' (default) → original Inertia view: resources/js/Pages/ProductEnquiry/Show.jsx
     * 'v2'           → AI-driven redesign:   resources/js/Pages/ProductEnquiry/ShowV2.jsx
     */
    'product_enquiry_design' => env('PRODUCT_ENQUIRY_DESIGN', 'v1'),

];
