using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

var files = new[] { 
    "backend/data/generators/mbeb.json",
    "backend/data/generators/incel.json"
};

var utf8 = new UTF8Encoding(false);

foreach (var file in files) {
    if (!File.Exists(file)) continue;
    var content = File.ReadAllText(file, Encoding.UTF8);
    // Replace standalone "eta" with "età", but ignore:
    // 1. [eta-...]  (preceded by [ or followed by -)
    // 2. "eta" (in quotes, as a key or string literal for groups)
    // We want to replace it only when it's a word in an Italian sentence.
    
    // Pattern: 
    // Lookbehind: not a [ or " or -
    // Word eta
    // Lookahead: not a ] or " or -
    
    // Instead of complex regex, let's just target the specific occurrences seen in grep!
    content = content.Replace("mezza eta", "mezza età");
    content = content.Replace("sua eta", "sua età");
    content = content.Replace("un eta", "un'età"); // also fix grammar
    content = content.Replace("sua Eta", "sua Età");
    content = content.Replace("mezza Eta", "mezza Età");

    File.WriteAllText(file, content, utf8);
    Console.WriteLine($"Restored readable accents in {file}");
}
