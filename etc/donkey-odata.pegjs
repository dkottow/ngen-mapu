

start
 = filterTerm

skip "$skip"
 = "$skip=" a:int {return {'param': '$skip', 'value': ~~a }; }
 
top "$top"
 = "$top=" a:int {return {'param': '$top', 'value': ~~a }; }

orderby "$orderby"
 = "$orderby=" f:field { return {'param': '$orderby', 'value': field}; }

filter "$filter"
 = "$filter=" filters:filterExpr { return {'param': '$filter', 'values': filters}; }

filterExpr "filter expression"
 = first:filterTerm others:(ws "and" ws term:filterTerm { return term; })* { return [first].concat(others || []); }

filterTerm
 = field:field ws op:op ws value:value { return {field:field, op: op, value: value }; }

op "operator"
 = "eq" 
 / "ne" 
 / "ge" 
 / "gt"

field "field name"
 = first:[a-z]i chars:fchar+ { return first + chars.join(''); }

fchar "name char"
 = [a-z0-9_]i

value
 = number
 / string


/**** from json *****/

ws "whitespace" = [ \t\n\r]+

/* ----- 6. Numbers ----- */

number "number"
  = minus? int frac? exp? { return parseFloat(text()); }

decimal_point = "."
digit1_9      = [1-9]
e             = [eE]
exp           = e (minus / plus)? DIGIT+
frac          = decimal_point DIGIT+
int           = zero / (digit1_9 DIGIT*)
minus         = "-"
plus          = "+"
zero          = "0"

/* ----- 7. Strings ----- */

string "string"
  = quotation_mark chars:char* quotation_mark { return chars.join(""); }

char
  = unescaped
  / escape
    sequence:(
        "'"
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

escape         = "\\"
quotation_mark = "'"
unescaped      = [\x20-\x26\x28-\x5B\x5D-\u10FFFF]

/* ----- Core ABNF Rules ----- */

/* See RFC 4234, Appendix B (http://tools.ietf.org/html/rfc4627). */
DIGIT  = [0-9]
HEXDIG = [0-9a-f]i


