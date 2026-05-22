<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ElevenLabsKnowledgeBase extends Model
{
    protected $table      = 'elevenlabs_knowledge_bases';
    protected $primaryKey = 'elevenlabs_kb_id';
    protected $keyType    = 'string';
    public    $incrementing = false;

    protected $fillable = [
        'elevenlabs_kb_id',
        'kb_name',
        'kb_type',
        'kb_rag_status',
    ];
}
