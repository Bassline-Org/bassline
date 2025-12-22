# === scout ===
proc scout {task outputCell} {
  set obs [ask mistral:latest $task]
  bl put [list path $outputCell type tcl/dict] [list observation $obs source mistral]
}

# === thinker ===
proc thinker {inputCell outputCell} {
  set data [bl get [list path $inputCell]]
  set obs [dict get $data body observation]
  set conclusion [ask qwen3:4b "Summarize this in one sentence: $obs"]
  bl put [list path $outputCell type tcl/dict] [list conclusion $conclusion]
}

# === research ===
proc research {question} {
  scout $question /store/research_obs
  thinker /store/research_obs /store/research_result
  set result [bl get {path /store/research_result}]
  dict get $result body conclusion
}

# === simple_async ===
proc simple_async {} {
  bl put {path /ollama/ask type tcl/dict} {prompt "Hi" model mistral:latest}
}

# === parallel_scouts ===
proc parallel_scouts {tasks} {
  set count [llength $tasks]
  set idx 0
  foreach task $tasks {
    set varname "scout_result_$idx"
    after idle "set $varname \[ask mistral:latest {$task}\]"
    incr idx
  }
  for {set i 0} {$i < $count} {incr i} {
    vwait "scout_result_$i"
  }
  set results {}
  for {set i 0} {$i < $count} {incr i} {
    lappend results [set "scout_result_$i"]
  }
  return $results
}

# === summarize_all ===
proc summarize_all {} {
  # Gather all observations
  set obs_keys {test_a test_b test_c test_d fixed_0 fixed_1 fixed_2 fixed_3}
  set all_obs {}
  
  foreach key $obs_keys {
    set result [bl get [list path /store/$key]]
    set body [dict get $result body]
    if {$body ne ""} {
      set obs [dict get $body observation]
      lappend all_obs "- $obs"
    }
  }
  
  # Combine into prompt
  set combined [join $all_obs "\n"]
  set prompt "Summarize these observations in 2-3 sentences:\n$combined"
  
  # Ask thinker model
  set response [ask qwen3:4b $prompt]
  
  # Store summary
  bl put {path /store/summary type tcl/dict} [list summary $response source qwen3:4b]
  
  return $response
}

# === cell_scout ===
proc cell_scout {topic} {
  set id "obs_[string map {{ } _} $topic]"
  set prompt "In 1-2 sentences, explain: $topic"
  set response [ask qwen3:4b $prompt]
  bl put [list path /store/$id type tcl/dict] [list topic $topic observation $response]
  bl put {path /cells/obs_ids/value type json} [concat {[\"} $id {\"]}]
  bl put {path /log} [list event scout:done topic $topic id $id]
  return $response
}

# === fetch_and_summarize ===
proc fetch_and_summarize {url} {
  set result [bl get [list path /slurp uri $url type text]]
  set content [dict get $result body]
  set prompt "Summarize this in 2-3 sentences:\n\n$content"
  set summary [ask qwen3:4b $prompt]
  return $summary
}

# === websearch ===
proc websearch {query} {
  set encoded [string map {{ } +} $query]
  set url "https://api.duckduckgo.com/?q=$encoded&format=json&no_html=1"
  set result [bl get [list path /slurp uri $url type json]]
  set body [dict get $result body]
  set abstract [dict get $body Abstract]
  set heading [dict get $body Heading]
  if {$abstract ne ""} {
    return "${heading}: ${abstract}"
  }
  return "No instant answer for: $query"
}

# === web_scout ===
proc web_scout {topic outputKey} {
  set search_result [websearch $topic]
  set prompt "Based on this information, give a concise 2-sentence summary:\n\n$search_result"
  set summary [ask qwen3:4b $prompt]
  bl put [list path /store/$outputKey type tcl/dict] [list topic $topic search $search_result summary $summary]
  bl put {path /log} [list event web_scout:done topic $topic key $outputKey]
  return $summary
}

# === backup_procs ===
proc backup_procs {filepath} {
  set result [bl put {path /sql/query} "SELECT key, value FROM _fn"]
  set rows [lrange $result 4 end]
  set parts {}
  foreach row $rows {
    set name [dict get $row key]
    set code [dict get $row value]
    lappend parts "# === $name ===\n$code"
  }
  set all_procs [join $parts "\n\n"]
  bl put [list path /barf uri "file://$filepath" type text] $all_procs
  return "Backed up [llength $rows] procs to $filepath"
}

# === scheduled_backup ===
proc scheduled_backup {interval} {
  set msg [backup_procs "/tmp/bassline-procs.tcl"]
  bl put {path /log} [list event backup:scheduled msg $msg]
  after $interval "scheduled_backup $interval"
  return "Backup done. Next in [expr {$interval / 1000}] seconds"
}

# === backup_blit ===
proc backup_blit {filepath} {
  set src [bl get {path /}]
  set blit_path [dict get $src body path]
  bl get [list path /slurp uri "file://$blit_path" type text]
  bl put [list path /barf uri "file://$filepath" type text] [bl get [list path /slurp uri "file://$blit_path" type text]]
  bl put {path /log} [list event blit_backup:done file $filepath]
  return "Backed up blit to $filepath"
}

# === my_procs ===
proc my_procs {} {
  set result [bl put {path /sql/query} "SELECT key FROM _fn ORDER BY key"]
  set rows [lrange $result 4 end]
  set names {}
  foreach row $rows {
    lappend names [dict get $row key]
  }
  return $names
}

# === my_cells ===
proc my_cells {} {
  set result [bl put {path /sql/query} "SELECT key FROM _cells"]
  set rows [lrange $result 4 end]
  set names {}
  foreach row $rows {
    lappend names [dict get $row key]
  }
  return $names
}

# === my_store_keys ===
proc my_store_keys {limit} {
  set result [bl put {path /sql/query} "SELECT key FROM _store ORDER BY key LIMIT $limit"]
  set rows [lrange $result 4 end]
  set keys {}
  foreach row $rows {
    lappend keys [dict get $row key]
  }
  return $keys
}

# === my_status ===
proc my_status {} {
  set procs [my_procs]
  set cells [my_cells]
  set store [my_store_keys 30]
  list procs [llength $procs] cells [llength $cells] store [llength $store] timestamp [clock format [clock seconds] -format "%Y-%m-%d %H:%M:%S"]
}

# === log_action ===
proc log_action {action result} {
  set ts [clock seconds]
  set entry [list ts $ts action $action result $result]
  bl put [list path /store/context/recent/$ts type tcl/dict] $entry
  return "logged"
}

# === recent_actions ===
proc recent_actions {limit} {
  set result [bl put {path /sql/query} "SELECT key, value FROM _store WHERE key LIKE 'context/recent/%' ORDER BY key DESC LIMIT $limit"]
  lrange $result 4 end
}

# === learn_from_error ===
proc learn_from_error {error_msg context model} {
  set ts [clock seconds]
  set analysis [ask $model "Why did this fail? Be brief (1-2 sentences). Error: $error_msg"]
  bl put [list path /store/learned/errors/$ts type tcl/dict] \
    [list error $error_msg context $context analysis $analysis ts $ts]
  log_action "learn_from_error" $analysis
  return $analysis
}

# === past_errors ===
proc past_errors {limit} {
  set result [bl put {path /sql/query} "SELECT value FROM _store WHERE key LIKE 'learned/errors/%' ORDER BY key DESC LIMIT $limit"]
  lrange $result 4 end
}

# === check_similar_errors ===
proc check_similar_errors {action} {
  set errors [past_errors 10]
  foreach err $errors {
    set data [dict get $err value]
    if {[string match "*$action*" [dict get $data context]]} {
      return [dict get $data analysis]
    }
  }
  return ""
}

# === remind ===
proc remind {minutes message} {
  set now [clock seconds]
  set expires [expr {$now + $minutes * 60}]
  bl put [list path /store/reminders/$now type tcl/dict] \
    [list expires $expires message $message status pending created $now]
  return "Reminder set for $minutes minutes: $message"
}

# === check_reminders ===
proc check_reminders {} {
  set now [clock seconds]
  set result [bl put {path /sql/query} "SELECT key, value FROM _store WHERE key LIKE 'reminders/%'"]
  set rows [lrange $result 4 end]
  set triggered {}
  foreach row $rows {
    set key [dict get $row key]
    set data [dict get $row value]
    set expires [dict get $data expires]
    set status [dict get $data status]
    if {$expires < $now && $status eq "pending"} {
      lappend triggered [dict get $data message]
      bl put [list path /store/$key type tcl/dict] \
        [list expires $expires message [dict get $data message] status done created [dict get $data created]]
    }
  }
  return $triggered
}

# === my_reminders ===
proc my_reminders {} {
  set result [bl put {path /sql/query} "SELECT key, value FROM _store WHERE key LIKE 'reminders/%' ORDER BY key DESC"]
  lrange $result 4 end
}

# === reflect ===
proc reflect {action result model} {
  set ts [clock seconds]
  set prompt "Reflect briefly on this action. Did it succeed? What can be learned? Action: $action Result: $result"
  set reflection [ask $model $prompt]
  bl put [list path /store/reflections/$ts type tcl/dict] \
    [list action $action result $result reflection $reflection ts $ts]
  return $reflection
}

# === my_reflections ===
proc my_reflections {limit} {
  set result [bl put {path /sql/query} "SELECT value FROM _store WHERE key LIKE 'reflections/%' ORDER BY key DESC LIMIT $limit"]
  lrange $result 4 end
}

# === agent ===
proc agent {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      set call [lindex [lindex $calls 0] 0]
      set call_id [dict get $call id]
      
      set fn [lindex [dict get $call function] 0]
      set fn_name [dict get $fn name]
      set args [lindex [dict get $fn arguments] 0]
      set method [dict get $args method]
      set path [dict get $args path]
      
      # Build args JSON for assistant message
      set args_json "\{\"method\":\"$method\",\"path\":\"$path\"\}"
      
      if {$method eq "get"} {
        set result [bl get [list path $path]]
      } else {
        set cbody ""
        catch {set cbody [dict get $args body]}
        set result [bl put [list path $path] $cbody]
      }
      
      set asst_msg [make_assistant_tool_call $call_id $fn_name $args_json]
      set tool_msg [make_tool_message $call_id $result]
      set msgs "\[$msg0,$asst_msg,$tool_msg\]"
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent_debug ===
proc agent_debug {task model} {
  set tools_json "\[\{\"type\":\"function\",\"function\":\{\"name\":\"bl\",\"description\":\"Access bassline. get/put to paths like /store/*\",\"parameters\":\{\"type\":\"object\",\"required\":\[\"method\",\"path\"\],\"properties\":\{\"method\":\{\"type\":\"string\"\},\"path\":\{\"type\":\"string\"\}\}\}\}\}\]"
  
  set messages_json "\[\{\"role\":\"user\",\"content\":\"$task\"\}\]"
  set req "\{\"model\":\"$model\",\"messages\":$messages_json,\"tools\":$tools_json\}"
  
  set response [bl put {path /ollama/chat type js/obj} $req]
  set body [dict get $response body]
  
  if {[dict exists $body tool_calls]} {
    set calls [dict get $body tool_calls]
    set first_call [lindex $calls 0]
    set fn [dict get $first_call function]
    set args [dict get $fn arguments]
    
    # Execute the call
    set method [dict get $args method]
    set path [dict get $args path]
    set result [bl get [list path $path]]
    
    return [list call $args result $result]
  }
  
  return [list answer [dict get $body text]]
}

# === agent_test ===
proc agent_test {} {
  set tools_json "\[\{\"type\":\"function\",\"function\":\{\"name\":\"bl\",\"description\":\"Access bassline\",\"parameters\":\{\"type\":\"object\",\"required\":\[\"method\",\"path\"\],\"properties\":\{\"method\":\{\"type\":\"string\"\},\"path\":\{\"type\":\"string\"\}\}\}\}\}\]"
  
  set messages_json "\[\{\"role\":\"user\",\"content\":\"Read /store/devlog/tool_calling_3\"\}\]"
  set req "\{\"model\":\"qwen3:4b\",\"messages\":$messages_json,\"tools\":$tools_json\}"
  
  bl put {path /ollama/chat type js/obj} $req
}

# === dict_to_json ===
proc dict_to_json {d} {
  set parts {}
  foreach k [dict keys $d] {
    set v [dict get $d $k]
    if {[string is integer $v]} {
      lappend parts "\"$k\":$v"
    } elseif {[string index $v 0] eq "\["} {
      lappend parts "\"$k\":$v"
    } elseif {[string index $v 0] eq "\{"} {
      lappend parts "\"$k\":$v"
    } else {
      lappend parts "\"$k\":\"$v\""
    }
  }
  return "\{[join $parts ,]\}"
}

# === make_bl_tools ===
proc make_bl_tools {} {
  return {[{"type":"function","function":{"name":"bl","description":"Access bassline resources. Use get to read, put to write. Paths include /store/*, /cells/*, /tcl/eval","parameters":{"type":"object","required":["method","path"],"properties":{"method":{"type":"string","enum":["get","put"]},"path":{"type":"string","description":"Resource path"},"body":{"type":"string","description":"Body for put requests"}}}}}]}
}

# === make_message ===
proc make_message {role content} {
  set esc [json_escape $content]
  return "\{\"role\":\"$role\",\"content\":\"$esc\"\}"
}

# === make_messages ===
proc make_messages {msg_list} {
  return "\[[join $msg_list ,]\]"
}

# === agent2 ===
proc agent2 {task model max_turns} {
  set tools [make_bl_tools]
  set msgs [list [make_message user $task]]
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set messages [make_messages $msgs]
    set req [dict_to_json [list model $model messages $messages tools $tools]]
    
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      foreach call $calls {
        set fn [dict get $call function]
        set args [dict get $fn arguments]
        set method [dict get $args method]
        set path [dict get $args path]
        
        if {$method eq "get"} {
          set result [bl get [list path $path]]
        } else {
          set cbody ""
          catch {set cbody [dict get $args body]}
          set result [bl put [list path $path] $cbody]
        }
        lappend msgs [make_message tool $result]
      }
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent3 ===
proc agent3 {task model max_turns} {
  set tools [make_bl_tools]
  set msgs [list [make_message user $task]]
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set messages [make_messages $msgs]
    set req "{\"model\":\"$model\",\"messages\":$messages,\"tools\":$tools}"
    
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      foreach call $calls {
        set fn [dict get $call function]
        set args [dict get $fn arguments]
        set method [dict get $args method]
        set path [dict get $args path]
        
        if {$method eq "get"} {
          set result [bl get [list path $path]]
        } else {
          set cbody ""
          catch {set cbody [dict get $args body]}
          set result [bl put [list path $path] $cbody]
        }
        lappend msgs [make_message tool $result]
      }
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === build_chat_req ===
proc build_chat_req {model messages tools} {
  set req "\{\"model\":\"$model\",\"messages\":$messages,\"tools\":$tools\}"
  return $req
}

# === agent4 ===
proc agent4 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      foreach call $calls {
        set fn [dict get $call function]
        set args [dict get $fn arguments]
        set method [dict get $args method]
        set path [dict get $args path]
        
        if {$method eq "get"} {
          set result [bl get [list path $path]]
        } else {
          set cbody ""
          catch {set cbody [dict get $args body]}
          set result [bl put [list path $path] $cbody]
        }
        set tool_msg [make_message tool $result]
        set msgs "\[$msg0,$tool_msg\]"
      }
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent5 ===
proc agent5 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    bl put {path /store/_debug/agent_req} $req
    
    set response [bl put {path /ollama/chat type js/obj} $req]
    bl put {path /store/_debug/agent_resp} $response
    
    set body [dict get $response body]
    bl put {path /store/_debug/agent_body} $body
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      bl put {path /store/_debug/agent_calls} $calls
      return [list status got_tool_calls turn $turn]
    }
    
    return [list status done turns $turn]
  }
  return [list status max_turns]
}

# === json_escape ===
proc json_escape {s} {
  set s [string map [list "\\" "\\\\"] $s]
  set s [string map [list "\"" "\\\""] $s]
  set s [string map [list "\n" "\\n"] $s]
  set s [string map [list "\t" "\\t"] $s]
  set s [string map [list "\r" "\\r"] $s]
  return $s
}

# === agent6 ===
proc agent6 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      foreach call $calls {
        set fn [dict get $call function]
        set args [dict get $fn arguments]
        set method [dict get $args method]
        set path [dict get $args path]
        
        if {$method eq "get"} {
          set result [bl get [list path $path]]
        } else {
          set cbody ""
          catch {set cbody [dict get $args body]}
          set result [bl put [list path $path] $cbody]
        }
        set tool_msg [make_message tool $result]
        set msgs "\[$msg0,$tool_msg\]"
      }
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent7 ===
proc agent7 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  set req [build_chat_req $model $msgs $tools]
  set response [bl put {path /ollama/chat type js/obj} $req]
  bl put {path /store/_debug/step1} $response
  
  set body [dict get $response body]
  bl put {path /store/_debug/step2} $body
  
  set calls [dict get $body tool_calls]
  bl put {path /store/_debug/step3} $calls
  
  set call [lindex $calls 0]
  bl put {path /store/_debug/step4} $call
  
  set fn [dict get $call function]
  bl put {path /store/_debug/step5} $fn
  
  return "got to step5"
}

# === agent8 ===
proc agent8 {task model} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  set req [build_chat_req $model $msgs $tools]
  set response [bl put {path /ollama/chat type js/obj} $req]
  
  bl put {path /store/_debug/raw_response} $response
  return $response
}

# === agent9 ===
proc agent9 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      set call [lindex $calls 0]
      
      set fn_wrapped [dict get $call function]
      set fn [lindex $fn_wrapped 0]
      
      set args_wrapped [dict get $fn arguments]
      set args [lindex $args_wrapped 0]
      
      set method [dict get $args method]
      set path [dict get $args path]
      
      if {$method eq "get"} {
        set result [bl get [list path $path]]
      } else {
        set cbody ""
        catch {set cbody [dict get $args body]}
        set result [bl put [list path $path] $cbody]
      }
      
      set tool_msg [make_message tool $result]
      set msgs "\[$msg0,$tool_msg\]"
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent10 ===
proc agent10 {task model} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  set req [build_chat_req $model $msgs $tools]
  set response [bl put {path /ollama/chat type js/obj} $req]
  bl put {path /store/_debug/a1} "step1 done"
  
  set body [dict get $response body]
  bl put {path /store/_debug/a2} "step2 done"
  
  set calls [dict get $body tool_calls]
  bl put {path /store/_debug/a3} "step3 done"
  
  set call [lindex $calls 0]
  bl put {path /store/_debug/a4_call} $call
  
  set fn_wrapped [dict get $call function]
  bl put {path /store/_debug/a5_fn_wrapped} $fn_wrapped
  
  set fn [lindex $fn_wrapped 0]
  bl put {path /store/_debug/a6_fn} $fn
  
  set args_wrapped [dict get $fn arguments]
  bl put {path /store/_debug/a7_args_wrapped} $args_wrapped
  
  set args [lindex $args_wrapped 0]
  bl put {path /store/_debug/a8_args} $args
  
  return "done"
}

# === agent_v2 ===
proc agent_v2 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    bl put [list path /store/_debug/turn_$turn] $req
    
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      set call [lindex [lindex $calls 0] 0]
      set fn [lindex [dict get $call function] 0]
      set args [lindex [dict get $fn arguments] 0]
      set method [dict get $args method]
      set path [dict get $args path]
      
      if {$method eq "get"} {
        set result [bl get [list path $path]]
      } else {
        set cbody ""
        catch {set cbody [dict get $args body]}
        set result [bl put [list path $path] $cbody]
      }
      
      bl put [list path /store/_debug/result_$turn] $result
      
      set tool_msg [make_message tool $result]
      set msgs "\[$msg0,$tool_msg\]"
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === agent_v3 ===
proc agent_v3 {task model max_turns} {
  set tools [make_bl_tools]
  set msg0 [make_message user $task]
  set msgs "\[$msg0\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    bl put [list path /store/_debug/req_$turn] $msgs
    
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    bl put [list path /store/_debug/resp_$turn] $body
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      set call [lindex [lindex $calls 0] 0]
      set fn [lindex [dict get $call function] 0]
      set args [lindex [dict get $fn arguments] 0]
      set method [dict get $args method]
      set path [dict get $args path]
      
      if {$method eq "get"} {
        set result [bl get [list path $path]]
      } else {
        set cbody ""
        catch {set cbody [dict get $args body]}
        set result [bl put [list path $path] $cbody]
      }
      
      set tool_msg [make_message tool $result]
      set msgs "\[$msg0,$tool_msg\]"
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === make_tool_message ===
proc make_tool_message {call_id content} {
  set esc [json_escape $content]
  return "\{\"role\":\"tool\",\"content\":\"$esc\",\"tool_call_id\":\"$call_id\"\}"
}

# === make_assistant_tool_call ===
proc make_assistant_tool_call {call_id tool_name args_json} {
  return "\{\"role\":\"assistant\",\"tool_calls\":\[\{\"id\":\"$call_id\",\"function\":\{\"name\":\"$tool_name\",\"arguments\":$args_json\}\}\]\}"
}

# === context_from_store ===
proc context_from_store {pattern limit} {
  set query "SELECT key, value FROM _store WHERE key LIKE '$pattern' ORDER BY key DESC LIMIT $limit"
  set result [bl put {path /sql/query} $query]
  set rows [lrange $result 4 end]
  set items {}
  foreach row $rows {
    set key [dict get $row key]
    set value [dict get $row value]
    lappend items [list key $key value $value]
  }
  return $items
}

# === context_from_procs ===
proc context_from_procs {filter} {
  set query "SELECT key, value FROM _fn WHERE key LIKE '$filter' ORDER BY key"
  set result [bl put {path /sql/query} $query]
  set rows [lrange $result 4 end]
  set items {}
  foreach row $rows {
    set name [dict get $row key]
    set code [dict get $row value]
    lappend items [list name $name code $code]
  }
  return $items
}

# === context_from_status ===
proc context_from_status {} {
  set procs [my_procs]
  set cells [my_cells]
  set store [my_store_keys 50]
  list procs $procs proc_count [llength $procs] cells $cells cell_count [llength $cells] store_keys $store store_count [llength $store] timestamp [clock format [clock seconds] -format "%Y-%m-%d %H:%M:%S"]
}

# === context_from_sql ===
proc context_from_sql {query} {
  set result [bl put {path /sql/query} $query]
  lrange $result 4 end
}

# === filter_recency ===
proc filter_recency {items hours} {
  set cutoff [expr {[clock seconds] - ($hours * 3600)}]
  set filtered {}
  foreach item $items {
    set ts 0
    catch {set ts [dict get $item ts]}
    catch {set ts [dict get $item timestamp]}
    if {$ts >= $cutoff} {
      lappend filtered $item
    }
  }
  return $filtered
}

# === filter_keyword ===
proc filter_keyword {items pattern} {
  set filtered {}
  foreach item $items {
    if {[string match "*$pattern*" $item]} {
      lappend filtered $item
    }
  }
  return $filtered
}

# === filter_limit ===
proc filter_limit {items count} {
  lrange $items 0 [expr {$count - 1}]
}

# === format_bullets ===
proc format_bullets {items} {
  set lines {}
  foreach item $items {
    if {[catch {dict get $item name} name] == 0} {
      lappend lines "- $name"
    } elseif {[catch {dict get $item key} key] == 0} {
      lappend lines "- $key"
    } else {
      lappend lines "- $item"
    }
  }
  join $lines "\n"
}

# === format_markdown ===
proc format_markdown {title items} {
  set lines {}
  lappend lines "## $title"
  lappend lines ""
  foreach item $items {
    if {[string is list $item] && [llength $item] >= 2} {
      set key ""
      set val ""
      catch {set key [dict get $item key]}
      catch {set key [dict get $item name]}
      catch {set val [dict get $item value]}
      catch {set val [dict get $item code]}
      if {$key ne ""} {
        lappend lines "### $key"
        lappend lines "$val"
        lappend lines ""
      } else {
        lappend lines "- $item"
      }
    } else {
      lappend lines "- $item"
    }
  }
  join $lines "\n"
}

# === format_summary ===
proc format_summary {data model max_words} {
  set prompt "Summarize the following in $max_words words or less:\n\n$data"
  ask $model $prompt
}

# === compile_context ===
proc compile_context {recipe_name} {
  set recipe_result [bl get [list path /store/recipe_$recipe_name]]
  set body [dict get $recipe_result body]
  set recipe [lindex $body 0]
  
  set all_items {}
  
  set sources [dict get $recipe sources]
  foreach src $sources {
    set src_type [dict get $src type]
    switch $src_type {
      store {
        set pattern [dict get $src pattern]
        set limit 10
        catch {set limit [dict get $src limit]}
        set items [context_from_store $pattern $limit]
        set all_items [concat $all_items $items]
      }
      procs {
        set filter "%"
        catch {set filter [dict get $src filter]}
        set items [context_from_procs $filter]
        set all_items [concat $all_items $items]
      }
      status {
        set status [context_from_status]
        lappend all_items [list type status data $status]
      }
      sql {
        set query [dict get $src query]
        set items [context_from_sql $query]
        set all_items [concat $all_items $items]
      }
    }
  }
  
  set formatter [dict get $recipe formatter]
  set fmt_type [dict get $formatter type]
  
  switch $fmt_type {
    markdown {
      set name [dict get $recipe name]
      format_markdown $name $all_items
    }
    bullets {
      format_bullets $all_items
    }
    summary {
      set model "qwen3:4b"
      catch {set model [dict get $formatter model]}
      set max_words 100
      catch {set max_words [dict get $formatter max_words]}
      format_summary $all_items $model $max_words
    }
    default {
      return $all_items
    }
  }
}

# === agent_with_context ===
proc agent_with_context {task model max_turns recipe_name} {
  set context [compile_context $recipe_name]
  set system_prompt "You have access to this context about the system:\n\n$context\n\nUse the bl tool to interact with bassline resources."
  
  set tools [make_bl_tools]
  set sys_msg [make_message system $system_prompt]
  set user_msg [make_message user $task]
  set msgs "\[$sys_msg,$user_msg\]"
  
  for {set turn 0} {$turn < $max_turns} {incr turn} {
    set req [build_chat_req $model $msgs $tools]
    set response [bl put {path /ollama/chat type js/obj} $req]
    set body [dict get $response body]
    
    if {[dict exists $body tool_calls]} {
      set calls [dict get $body tool_calls]
      set call [lindex [lindex $calls 0] 0]
      set call_id [dict get $call id]
      
      set fn [lindex [dict get $call function] 0]
      set fn_name [dict get $fn name]
      set args [lindex [dict get $fn arguments] 0]
      set method [dict get $args method]
      set path [dict get $args path]
      
      set args_json "\{\"method\":\"$method\",\"path\":\"$path\"\}"
      
      if {$method eq "get"} {
        set result [bl get [list path $path]]
      } else {
        set cbody ""
        catch {set cbody [dict get $args body]}
        set result [bl put [list path $path] $cbody]
      }
      
      set asst_msg [make_assistant_tool_call $call_id $fn_name $args_json]
      set tool_msg [make_tool_message $call_id $result]
      set msgs "\[$sys_msg,$user_msg,$asst_msg,$tool_msg\]"
      continue
    }
    
    return [list status done turns $turn answer [dict get $body text]]
  }
  return [list status max_turns]
}

# === filter_semantic ===
proc filter_semantic {items query model top_k} {
  if {[llength $items] == 0} {
    return {}
  }
  
  set item_list {}
  set idx 0
  foreach item $items {
    lappend item_list "${idx}: $item"
    incr idx
  }
  set items_str [join $item_list "\n"]
  
  set prompt "Given this query: \"$query\"\n\nRank these items by relevance and return ONLY the indices of the top $top_k most relevant items as comma-separated numbers (e.g., \"2,0,5\"). Items:\n\n$items_str"
  
  set response [ask $model $prompt]
  
  set indices [split [string trim $response] ","]
  set filtered {}
  foreach i $indices {
    set i [string trim $i]
    if {[string is integer $i] && $i >= 0 && $i < [llength $items]} {
      lappend filtered [lindex $items $i]
    }
  }
  return $filtered
}

# === prepare_handoff ===
proc prepare_handoff {summary model} {
  set status [my_status]
  set recent_devlog [context_from_store "devlog%" 5]
  set recent_errors [context_from_store "learned/errors%" 3]
  
  set handoff_data [list \
    summary $summary \
    status $status \
    recent_work $recent_devlog \
    recent_errors $recent_errors \
    timestamp [clock seconds] \
  ]
  
  set prompt "Compress this session state into a concise handoff note (3-5 bullets) for the next agent:\n\n$handoff_data"
  set compressed [ask $model $prompt]
  
  bl put {path /store/session_handoff type tcl/dict} [list \
    raw $handoff_data \
    compressed $compressed \
    ts [clock seconds] \
  ]
  
  return "Handoff prepared: $compressed"
}

# === resume_session ===
proc resume_session {} {
  compile_context session_resume
}

# === get_handoff ===
proc get_handoff {} {
  set result [bl get {path /store/session_handoff}]
  set body [dict get $result body]
  if {[catch {dict get $body compressed} compressed]} {
    return "No handoff found"
  }
  return $compressed
}

# === view_overview ===
proc view_overview {} {
  set status [my_status]
  list type overview procs [dict get $status procs] cells [dict get $status cells] store [dict get $status store] timestamp [dict get $status timestamp]
}

# === view_proc ===
proc view_proc {name} {
  set result [bl get [list path /fn/$name]]
  set code [dict get $result body]
  set lines [llength [split $code "\n"]]
  set preview [string range $code 0 60]
  list type proc name $name lines $lines preview $preview
}

# === view_cell ===
proc view_cell {name} {
  set result [bl get [list path /cells/$name]]
  set body [dict get $result body]
  set value ""
  set lattice ""
  catch {set value [dict get $body value]}
  catch {set lattice [dict get $body lattice]}
  list type cell name $name value $value lattice $lattice
}

# === view_procs_list ===
proc view_procs_list {} {
  set names [my_procs]
  set items {}
  foreach name $names {
    set result [bl get [list path /fn/$name]]
    set code [dict get $result body]
    set lines [llength [split $code "\n"]]
    lappend items [list name $name lines $lines]
  }
  list type proc_list count [llength $names] items $items
}

# === view ===
proc view {path} {
  set parts [split $path "/"]
  set first [lindex $parts 0]
  set second [lindex $parts 1]
  
  switch $first {
    "" { view_overview }
    procs {
      if {$second eq ""} {
        view_procs_list
      } else {
        view_proc $second
      }
    }
    cells {
      if {$second eq ""} {
        list type cell_list cells [my_cells]
      } else {
        view_cell $second
      }
    }
    default {
      list type error msg "unknown view: $path"
    }
  }
}

# === spec_escape_string ===
proc spec_escape_string {s} {
  set s [string map [list "\\" "\\\\" "\"" "\\\""] $s]
  set s [string map [list "\n" "\\n"] $s]
  set s [string map [list "\t" "\\t"] $s]
  set s [string map [list "\r" "\\r"] $s]
  return $s
}

# === spec_to_json ===
proc spec_to_json {spec data} {
  set kind [lindex $spec 0]
  
  switch $kind {
    string {
      return "\"[spec_escape_string $data]\""
    }
    number {
      return $data
    }
    bool {
      if {$data eq "true" || $data eq "1"} {
        return "true"
      } else {
        return "false"
      }
    }
    null {
      return "null"
    }
    object {
      set fields [lrange $spec 1 end]
      set parts {}
      for {set i 0} {$i < [llength $fields]} {incr i 2} {
        set fname [lindex $fields $i]
        set ftype [lindex $fields [expr {$i + 1}]]
        if {[dict exists $data $fname]} {
          set fvalue [dict get $data $fname]
          set json_val [spec_to_json $ftype $fvalue]
          lappend parts "\"$fname\":$json_val"
        }
      }
      return "\{[join $parts ,]\}"
    }
    list {
      set item_type [lindex $spec 1]
      set parts {}
      foreach item $data {
        lappend parts [spec_to_json $item_type $item]
      }
      return "\[[join $parts ,]\]"
    }
    optional {
      if {$data eq ""} {
        return "null"
      }
      return [spec_to_json [lindex $spec 1] $data]
    }
    ref {
      set ref_name [lindex $spec 1]
      set ref_spec [spec_get $ref_name]
      return [spec_to_json $ref_spec $data]
    }
    default {
      error "spec_to_json: unknown type '$kind'"
    }
  }
}

# === spec_define ===
proc spec_define {name spec} {
  bl put [list path /store/spec_$name type text] $spec
  return "defined: $name"
}

# === spec_get ===
proc spec_get {name} {
  set result [bl get [list path /store/spec_$name]]
  dict get $result body
}