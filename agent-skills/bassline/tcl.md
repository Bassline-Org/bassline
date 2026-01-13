# TCL - Scripting Language

Bassline includes a TCL interpreter for boot scripts, automation, and configuration. TCL (Tool Command Language) uses simple syntax: everything is a command with arguments.

## Basic Syntax

```tcl
command arg1 arg2 arg3
```

Every line is a command followed by arguments. No parentheses, no commas.

## Variables

```tcl
# Set a variable
set name "Alice"
set count 42

# Read a variable
puts $name        # prints: Alice
puts $count       # prints: 42

# Increment
incr count        # count is now 43
incr count 10     # count is now 53
```

## Strings and Substitution

```tcl
# Double quotes - variables are substituted
set greeting "Hello, $name!"    # "Hello, Alice!"

# Braces - no substitution (literal)
set pattern {$name}             # "$name" literally

# Command substitution with brackets
set len [string length $name]   # 5
```

## Control Flow

### if/else

```tcl
if {$count > 10} {
  puts "Big number"
} else {
  puts "Small number"
}

# Condition is an expression, not a command
if {$x == 0 && $y > 5} {
  puts "Match"
}
```

### while

```tcl
set i 0
while {$i < 5} {
  puts $i
  incr i
}
```

### for

```tcl
for {set i 0} {$i < 10} {incr i} {
  puts "i = $i"
}
```

### foreach

```tcl
# Single variable
foreach item {apple banana cherry} {
  puts $item
}

# Multiple variables
foreach {key value} {name Alice age 30} {
  puts "$key: $value"
}
```

### switch

```tcl
switch $color {
  red   { puts "Stop" }
  yellow { puts "Caution" }
  green { puts "Go" }
  default { puts "Unknown" }
}

# With -glob matching
switch -glob $filename {
  *.txt { puts "Text file" }
  *.js  { puts "JavaScript" }
  default { puts "Other" }
}
```

## Procedures

```tcl
proc greet {name} {
  return "Hello, $name!"
}

puts [greet "World"]  # Hello, World!

# Multiple parameters
proc add {a b} {
  return [expr {$a + $b}]
}

puts [add 3 4]  # 7
```

## Lists

```tcl
# Create a list
set colors {red green blue}

# List operations
lindex $colors 0          # red
lindex $colors end        # blue
llength $colors           # 3
lappend colors yellow     # {red green blue yellow}
linsert $colors 1 orange  # {red orange green blue}
lrange $colors 0 1        # {red green}
lsearch $colors green     # 1 (index)
lsort $colors             # {blue green red}
lreverse $colors          # {blue green red}

# Iterate
foreach color $colors {
  puts $color
}

# Join to string
join $colors ", "         # "red, green, blue"

# Split string to list
split "a,b,c" ","         # {a b c}
```

## Dictionaries

```tcl
# Create a dict
set person {name Alice age 30 city Boston}

# Dict operations
dict get $person name           # Alice
dict set person email a@b.com   # adds email key
dict exists $person age         # 1 (true)
dict keys $person               # {name age city email}
dict values $person             # {Alice 30 Boston a@b.com}
dict size $person               # 4

# Iterate
dict for {key value} $person {
  puts "$key = $value"
}

# Create from pairs
dict create name Bob age 25
```

## Strings

```tcl
string length $str           # character count
string index $str 0          # first character
string range $str 0 4        # substring
string tolower $str
string toupper $str
string trim $str             # remove whitespace
string trim $str "xyz"       # remove specific chars
string match "*.txt" $file   # glob matching
string equal $a $b           # comparison
string compare $a $b         # -1, 0, or 1
string first "sub" $str      # find index
string replace $str 0 4 "new"
string repeat "ab" 3         # "ababab"
```

## Expressions

The `expr` command evaluates mathematical expressions:

```tcl
expr {1 + 2}          # 3
expr {$x * $y}        # multiplication
expr {$a / $b}        # division
expr {$n % 2}         # modulo
expr {$x ** 2}        # power

# Comparisons (return 1 or 0)
expr {$a == $b}
expr {$a != $b}
expr {$a < $b}
expr {$a > $b}
expr {$a <= $b}
expr {$a >= $b}

# Boolean
expr {$a && $b}       # and
expr {$a || $b}       # or
expr {!$a}            # not

# Ternary
expr {$x > 0 ? "positive" : "non-positive"}

# Math functions
expr {abs(-5)}        # 5
expr {max(1, 2, 3)}   # 3
expr {min(1, 2, 3)}   # 1
expr {round(3.7)}     # 4
expr {floor(3.7)}     # 3
expr {ceil(3.2)}      # 4
expr {sqrt(16)}       # 4.0
expr {sin(0)}         # 0.0
expr {cos(0)}         # 1.0
expr {rand()}         # random 0-1
```

## Error Handling

```tcl
# Catch errors
if {[catch {risky_command} result]} {
  puts "Error: $result"
} else {
  puts "Success: $result"
}

# Throw an error
error "Something went wrong"
```

## Blit-Specific Commands

When running in a blit boot script, these commands are available:

### cell

```tcl
cell create counter -lattice maxNumber
cell set counter 10
cell value counter        # 10
cell get counter          # {"lattice":"maxNumber","value":10}
cell exists counter       # 1
```

### store

```tcl
store set config {name "App" version "1.0"}
store get config          # {"name":"App","version":"1.0"}
store keys                # config
store delete config
```

### sql

```tcl
# Query (SELECT)
set rows [sql query "SELECT * FROM _store"]

# Execute (INSERT/UPDATE/DELETE)
sql execute "INSERT INTO custom (id, data) VALUES (?, ?)" 1 "hello"
```

### kit

```tcl
# Access parent kit
kit get /config/global
kit put /events/log {type "boot" message "Started"}
```

## Common Patterns

### Configuration File

```tcl
# Define defaults, then override
set config {
  debug false
  port 8080
  host localhost
}

# Override from environment or conditions
if {[info exists env(DEBUG)]} {
  dict set config debug true
}
```

### Initialization Script

```tcl
# Create required cells
foreach {name lattice} {
  counter maxNumber
  errors setUnion
  config object
  ready boolean
} {
  cell create $name -lattice $lattice
}

# Set initial values
cell set counter 0
cell set config {initialized true timestamp 0}
```

### Data Migration

```tcl
# Check version and migrate
set version [store get version]
if {$version eq ""} {
  # First run
  store set version "1.0"
  cell create users -lattice setUnion
}

if {$version eq "1.0"} {
  # Migrate to 2.0
  cell create sessions -lattice object
  store set version "2.0"
}
```

### Conditional Setup

```tcl
# Only create if doesn't exist
if {![cell exists counter]} {
  cell create counter -lattice maxNumber
  cell set counter 0
}

# Feature flags
set features {analytics true notifications false}
dict for {feature enabled} $features {
  if {$enabled} {
    cell create feature_$feature -lattice boolean
    cell set feature_$feature 1
  }
}
```
