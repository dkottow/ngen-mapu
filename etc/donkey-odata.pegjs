/* to generate app/QueryParser.js from this spec run from root dir as follows

   > node_modules/pegjs/bin/pegjs etc/donkey-odata.pegjs app/QueryParser.js

   also copy parser to www app
*/

start
 = param

param
 = paramSkip
 / paramTop
 / paramOrderBy
 / paramFilter
 / paramSelect

paramSkip
 = "$skip=" a:$int 
   {return {name: '$skip', value: parseInt(a) }; }
 
paramTop
 = "$top=" a:$int 
   {return {name: '$top', value: parseInt(a) }; }

paramOrderBy
 = "$orderby=" orderby:orderByExpr 
   { return {name: '$orderby', value: orderby}; }

paramSelect
 = "$select=" fields:fieldExpr 
   { return {name: '$select', value: fields}; }

paramFilter
 = "$filter=" filters:filterExpr 
   { return {name: '$filter', value: filters}; }

orderByExpr
 = first:orderByTerm
   rest:("," ws? term:orderByTerm { return term; })*
   { return [first].concat(rest); }

filterExpr
 = first:filterTerm 
   rest:(sep:filterSep term:filterTerm { return term; })*	
   { return [first].concat(rest); }

/* separate filters either by 'and' keyword or \t char */
filterSep
 = (ws "and" ws) / ("\t" ws?)

fieldExpr
 = first:fieldTerm
   rest:("," ws? term:fieldTerm { return term; })*
   { return [first].concat(rest); }

orderByTerm
 = table:(table ".")? field:field ws? order:('asc'i / 'desc'i)?
   { 
     var result = { 
       table: table ? table[0] : undefined, 
       field: field, 
       order: order || 'asc' 
     };  
     return result; 
   }
   
filterTerm
 = table:(table ".")? field:field ws 
   op:((op ws value) / (vecop ws values))
   { 
   	 var result = {
    		table: table ? table[0] : undefined,
    		field: field,
    		op: op[0],
    		value: op[2]
     };	  
	    return result;
   }

fieldTerm
 = table:(table ".")? field:field
   { 
     var result = { 
      table: table ? table[0] : undefined, 
      field: field 
     }; 
     return result; 
   }

table
 = identifier

field
 = identifier / "*"

op "operator"
 = "eq" 
 / "ne" 
 / "ge" 
 / "gt"
 / "le"
 / "lt"
 / "search"

vecop "vector operator"
 = "in"
 / "btwn"

identifier "identifier"
 = first:[a-z0-9_]i chars:fchar* 
   { return first + chars.join(''); }

fchar "name char"
 = [a-z0-9_]i

values
 = first:value
   rest:("," ws? value:value { return value; })*
   { return [first].concat(rest); }

value
 = number
 / string
 / null

null "null"
  = "null" { return null; }

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


