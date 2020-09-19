# knack-extensions
Utility scripts to customize knack.com database-driven websites



## Rules of a good knack extension

 * Do not use the object API, use the view API. Object API leaks the API key to anyone viewing the website
 * reuse existing knack forms/buttons/etc as much as possible, changing values, instead of adding new html elements. This makes your code more future-proof if they add new classes/etc
 * avoid global variables. Wrap your utility code in TODO
