'use strict';

; (function (root) {
  /**
   * The variables.
   * Should be initialized at the beginning of the format.
   * { fmtSign } Possibal value: 'ost' | 'col' | 'val' | 'end' | 'war' | 'scc' | 'err';
   * { fmtType } Possibal value: 'info' | 'success' | 'warning' | 'danger';
   */
  let fmtSource
    , curLevel
    , curIndex
    , baseIndent
    , exceptType
    , exceptSign
    , signsQueue
    , isSrcValid
    , isFmtError
    , resultOnly
    , fmtResult
    , fmtType
    , fmtSign
    , fmtLines
    , message
    , errFormat
    , errNear
    , errIndex
    , errExpect
    , fmtOptions;

  const initVariables = function(source) {
    fmtSource = source;
    curLevel = 0;
    curIndex = 1;
    exceptType = '';
    exceptSign = '';
    signsQueue = '';
    isSrcValid = true;
    isFmtError = false;
    resultOnly = false;
    fmtResult = '';
    fmtType = 'info';
    fmtSign = '';
    fmtLines = 0;
    message = '';
    errFormat = false;
    errNear = '';
    errIndex = NaN;
    errExpect = '';
    fmtOptions = {
      indent: 2,
      isExpand: true,
      isStrict: false,
      isEscape: false,
      isUnscape: false,
      keyQtMark: '"', // '\'' | '\"' | '';
      valQtMark: '"', // '\'' | '\"';
    };
  }

  /**
   * The constants.
   */
  const SPACE = ' ';
  const BREAK = '\r\n';

  const ESCAPES_MAP = [
    {ptn: /\r\n/mg, str: ''},
    {ptn: /\n\r/mg, str: ''},
    {ptn: /\n/mg,   str: '\\n'},
    {ptn: /\r/mg,   str: '\\r'},
    {ptn: /\f/mg,   str: '\\f'},
    {ptn: /\t/mg,   str: '\\t'},
    {ptn: //mg,    str: '\\b'},
    {ptn: //mg,    str: '\\v'},
  ];

  const MESSAGES_MAP = {
    ost: rowIdx => `Expect a string in line: ${rowIdx}`,
    col: rowIdx => `Expect a colon in line: ${rowIdx}`,
    val: rowIdx => `Invalid value in line: ${rowIdx}`,
    end: (rowIdx, brc) => `Expect a comma or a \"${brc}\" in line: ${rowIdx}`,
    war: rowIdx => `Formated ${rowIdx} lines, abnormal JSON source!`,
    scc: rowIdx => `Success formated ${rowIdx} lines!`,
    err: () => `Parse Error, an excessive abnormal Json!`,
  }

  /**
   * =================================================================
   * The main function of `format-to-json` util.
   * @param { string } source 
   * @param { object } options 
   * =================================================================
   */
  function formatToJson(source, options) {
    return new Promise(resolve => {
      initVariables(source);
      if (options) {
        if (typeof options.indent === 'number' && options.indent > 0) {
          fmtOptions.indent = options.indent;
        };
        if (typeof options.resultOnly === 'boolean') {
          resultOnly = options.resultOnly;
        }
        if (typeof options.isExpand === 'boolean') {
          fmtOptions.isExpand = options.isExpand;
        }
        if (typeof options.isStrict === 'boolean') {
          fmtOptions.isStrict = options.isStrict;
        }
        if (typeof options.isEscape === 'boolean') {
          fmtOptions.isEscape = options.isEscape;
        }
        if (typeof options.isUnscape === 'boolean') {
          fmtOptions.isUnscape = options.isUnscape;
        }
        if (['\'', '"', ''].includes(options.keyQtMark)) {
          fmtOptions.keyQtMark = options.keyQtMark;
        }
        if (['\'', '"'].includes(options.valQtMark)) {
          fmtOptions.valQtMark = options.valQtMark;
        }
      }
      baseIndent = getBaseIndent();
      try {
        try {
          if (fmtSource !== '') eval(`fmtSource = ${fmtSource}`);
          if (fmtSource === '' || ['object', 'boolean'].includes(typeof fmtSource)) {
            doNormalFormat(fmtSource);
          } else {
            if (fmtOptions.isUnscape) {
              fmtSource = fmtSource.replace(/\\"/mg, '"').replace(/\\\\/mg, '\\');
            }
            doSpecialFormat();
          }
        } catch (err) {
          // console.log(err);
          if (fmtOptions.isUnscape) {
            fmtSource = fmtSource.replace(/\\"/mg, '"').replace(/\\\\/mg, '\\');
          }
          doSpecialFormat();
        }
      } catch (err) {
        // console.log(err);
        isFmtError = true;
      } finally {
        setFmtStatus();
        resolve(resultOnly ? fmtResult : {
          result: fmtResult,
          status: {
            fmtType, fmtSign, fmtLines, message,
            errFormat, errIndex, errExpect, errNear,
          }
        });
      }
    });
  }

  /**
   * =================================================================
   * Format the Normal JSON source
   * @param {*} src 
   * =================================================================
   */
  function doNormalFormat(src) {
    if ([true, false, null, ''].includes(src)) {
      return fmtResult += String(src);
    }
    if (fmtOptions.isStrict) {
      src = JSON.parse(JSON.stringify(src));
    }
    src instanceof Array ? arrayHandler(src) : objectHandler(src);
  }

  function arrayHandler(srcArr) {
    let curIndent;
    if (srcArr.length > 0) {
      fmtResult += brkLine4Normal('[');
      if (fmtOptions.isExpand) curIndex ++;
      curLevel++;
      for (let i = 0; i < srcArr.length; i++) {
        curIndent = fmtOptions.isExpand ? getCurIndent() : '';
        fmtResult += curIndent;
        valueHandler(srcArr[i]);
        fmtResult += brkLine4Normal(i < srcArr.length - 1 ? ',' : '');
      }
      curLevel--;
      curIndent = fmtOptions.isExpand ? getCurIndent() : '';
      fmtResult += curIndent + ']';
    } else {
      fmtResult += '[]';
    }
  }

  function objectHandler(srcObj) {
    let curIndent;
    if (Object.keys(srcObj).length > 0) {
      fmtResult += brkLine4Normal('{');
      curLevel++;
      let index = 0;
      const objKeys = Object.keys(srcObj);
      for (const key in srcObj) {
        index ++;
        const prop = quoteNormalStr(key, fmtOptions.keyQtMark);
        curIndent = fmtOptions.isExpand ? getCurIndent() : '';
        fmtResult += curIndent;
        fmtResult += prop;
        fmtResult += fmtOptions.isExpand ? ': ' : ':';
        valueHandler(srcObj[key]);
        fmtResult += brkLine4Normal(index < objKeys.length ? ',' : '');
      }
      curLevel--;
      curIndent = fmtOptions.isExpand ? getCurIndent() : '';
      fmtResult += curIndent + '}';
    } else {
      fmtResult += '{}';
    }
  }

  function valueHandler(value) {
    switch (typeof value) {
      case 'undefined': case 'function': return fmtResult += String(value);
      case 'number': case 'boolean': return fmtResult += value;
      case 'object': return doNormalFormat(value);
      case 'string': return fmtResult += quoteNormalStr(value, fmtOptions.valQtMark);
    }
  }

  /**
   * =================================================================
   * Format the Abnormal JSON source
   * =================================================================
   */
  function doSpecialFormat() {
    fmtSource = fmtSource.replace(/^\s*/, '');
    if (fmtSource.length === 0) return;
    let isMatched = false;
    switch (fmtSource[0]) {
      case '\'':
      case '"': isMatched = true; quotaHandler();  break;
      case ':': isMatched = true; colonHandler();  break;
      case ',': isMatched = true; commaHandler();  break;
      case '{': isMatched = true; objPreHandler(); break;
      case '}': isMatched = true; objEndHandler(); break;
      case '[': isMatched = true; arrPreHandler(); break;
      case ']': isMatched = true; arrEndHandler(); break;
      case '(': isMatched = true; tupPreHandler(); break;
      case ')': isMatched = true; tupEndHandler(); break;
    }
    if (!isMatched) {
      const unicMt = fmtSource.match(/^u(\s)?'|^u(\s)?"/);
      if (unicMt) {
        isMatched = true;
        unicHandler(unicMt[0]);
      }
    }
    if (!isMatched) {
      const numbMt = fmtSource.match(/^(-?[0-9]+\.?[0-9]*|0[xX][0-9a-fA-F]+)/);
      if (numbMt) {
        isMatched = true;
        numbHandler(numbMt[0]);
      }
    }
    if (!isMatched) {
      const boolMt = fmtSource.match(/^(true|false|True|False)/);
      if (boolMt) {
        isMatched = true;
        boolHandler(boolMt[0]);
      }
    }
    if (!isMatched) {
      const nullMt = fmtSource.match(/^(null|undefined|None|NaN)/);
      if (nullMt) {
        isMatched = true;
        nullHandler(nullMt[0]);
      }
    }
    if (!isMatched) otheHandler();
    return doSpecialFormat();
  }

  function quotaHandler() {
    const rest = getSrcRest();
    const restIdx = getNextQuotaIndex(fmtSource[0], rest);
    chkFmtExpect(fmtSource[0]);
    const quoteMt = fmtSource.substr(0, 1);
    const isProperty = exceptType === 'ost';
    let strInQuote = '';
    if (restIdx > -1) {
      strInQuote = fmtSource.substr(1, restIdx);
      fmtResult += quoteSpecialStr(strInQuote, quoteMt, isProperty);
      setFmtExpect(fmtSource[0]);
      fmtSource = getSrcRest(restIdx + 2);
    } else {
      strInQuote = fmtSource.substr(1);
      fmtResult += quoteSpecialStr(strInQuote, quoteMt, isProperty);
      setFmtExpect('!');
      fmtSource = '';
    }
  }

  function colonHandler() {
    fmtResult += fmtOptions.isExpand ? ': ' : ':';
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    fmtSource = getSrcRest();
  }

  function commaHandler() {
    const curIndent = getCurIndent();
    if (fmtOptions.isExpand) curIndex ++;
    fmtResult += fmtOptions.isExpand ? `,${BREAK + curIndent}` : ',';
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    fmtSource = getSrcRest();
    if (fmtSource.replace(/(\r)?\n|\s/mg, '') === '') setFmtError('val');
  }

  function objPreHandler() {
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    if (fmtSource[1] && fmtSource[1] === '}') {
      fmtResult += '{}';
      setFmtExpect('}');
      fmtSource = getSrcRest(2);
    } else {
      curLevel++;
      fmtResult += '{';
      brkLine4Special();
      fmtSource = getSrcRest();
    }
  }

  function objEndHandler() {
    curLevel--;
    brkLine4Special('}');
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    fmtSource = getSrcRest();
  }

  function arrPreHandler() {
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    if (fmtSource[1] && fmtSource[1] === ']') {
      fmtResult += '[]';
      setFmtExpect(']');
      fmtSource = getSrcRest(2);
    } else {
      curLevel++;
      fmtResult += '[';
      brkLine4Special();
      fmtSource = getSrcRest();
    }
  }

  function arrEndHandler() {
    curLevel--;
    brkLine4Special(']');
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    fmtSource = getSrcRest();
  }

  function tupPreHandler() {
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    if (fmtSource[1] && fmtSource[1] === ')') {
      fmtResult += fmtOptions.isStrict ? '[]' : '()';
      setFmtExpect(')');
      fmtSource = getSrcRest(2);
    } else {
      curLevel++;
      fmtResult += fmtOptions.isStrict ? '[' : '(';
      brkLine4Special();
      fmtSource = getSrcRest();
    }
  }

  function tupEndHandler() {
    curLevel--;
    brkLine4Special(fmtOptions.isStrict ? ']' : ')');
    chkFmtExpect(fmtSource[0]);
    setFmtExpect(fmtSource[0]);
    fmtSource = getSrcRest();
  }

  function unicHandler(unicMt) {
    const rest = getSrcRest(unicMt.length);
    const restIdx = unicMt.indexOf('\'') > -1
      ? getNextQuotaIndex('\'', rest)
      : getNextQuotaIndex('"', rest);
    chkFmtExpect('u');
    const isProperty = exceptType === 'ost';
    let uniqStr = '';
    if (restIdx > -1) {
      const cutIdx = restIdx + unicMt.length + 1;
      uniqStr = fmtSource.substr(unicMt.length, cutIdx - unicMt.length - 1);
      fmtResult += quoteSpecialStr(uniqStr, unicMt, isProperty);
      setFmtExpect('u');
      fmtSource = getSrcRest(cutIdx);
    } else {
      uniqStr = fmtSource.substr(unicMt.length);
      fmtResult += quoteSpecialStr(uniqStr, unicMt, isProperty);
      setFmtExpect('!');
      fmtSource = '';
    }
  }

  function numbHandler(numbMt) {
    fmtResult += numbMt;
    chkFmtExpect('n');
    setFmtExpect('n');
    fmtSource = getSrcRest(numbMt.length);
  }

  function boolHandler(boolMt) {
    fmtResult += fmtOptions.isStrict ? boolMt.toLowerCase() : boolMt;
    chkFmtExpect('b');
    setFmtExpect('b');
    fmtSource = getSrcRest(boolMt.length);
  }

  function nullHandler(nullMt) {
    fmtResult += fmtOptions.isStrict ? 'null' : nullMt;
    chkFmtExpect('N');
    setFmtExpect('N');
    fmtSource = getSrcRest(nullMt.length);
  }

  function otheHandler() {
    const strMatch = fmtSource.match(/^[^\{\}\[\]\(\):,]*/);
    const strMated = strMatch && strMatch[0] || '';
    if (strMated) {
      fmtResult += strMated;
      chkFmtExpect('!');
      fmtSource = getSrcRest(strMated.length);
    }
  }

  function chkFmtExpect(sign) {
    if (isSrcValid) {
      switch (exceptType) {
        case 'val':
          if (':,}])!'.includes(sign)) {
            setFmtError('val');
          } break;
        case 'ost':
          if (!'\'"unbN'.includes(sign)) {
            setFmtError('ost');
          } break;
        case 'end':
          const endBracket = getBracketPair(exceptSign);
          if (![',', endBracket].includes(sign)) {
            setFmtError('end', endBracket);
          } break;
        case 'col':
          if (sign !== ':') {
            setFmtError('col');
          } break;
      }
    }
  }

  function setFmtExpect(sign) {
    switch (sign) {
      case ':':
        exceptType = 'val';
        break;
      case ',':
        exceptSign === '{' ? exceptType = 'ost' : exceptType = 'val';
        break;
      case '{':
        exceptSign = sign;
        signsQueue += sign;
        exceptType = 'ost';
        break;
      case '}':
        signsQueue = signsQueue.substr(0, signsQueue.length - 1);
        exceptSign = signsQueue.substr(-1);
        exceptType = 'end';
        break;
      case '[':
        exceptSign = sign;
        signsQueue += sign;
        exceptType = 'val';
        break;
      case ']':
        signsQueue = signsQueue.substr(0, signsQueue.length - 1);
        exceptSign = signsQueue.substr(-1);
        exceptType = 'end';
        break;
      case '(':
        exceptSign = sign;
        signsQueue += sign;
        exceptType = 'val';
        break;
      case ')':
        signsQueue = signsQueue.substr(0, signsQueue.length - 1);
        exceptSign = signsQueue.substr(-1);
        exceptType = 'end';
        break;
      case 'u':
      case 'n':
      case 'b':
      case 'N':
      case '"':
      case '\'':
        exceptType === 'ost' ? exceptType = 'col' : exceptType = 'end';
        break;
    }
  }

  function setFmtError(sign, brc = '') {
    switch (sign) {
      case 'war': fmtType = 'warning'; break;
      case 'scc': fmtType = 'success'; break;
      default: fmtType = 'danger'; break;
    }
    if (['ost', 'col', 'val', 'end'].includes(sign)) {
      errFormat = true;
      isSrcValid = false;
      errExpect = brc;
      errIndex = curIndex;
      console.log(fmtResult);
      console.log(fmtSource);
      const rstTrailing = fmtResult.substr(-20).replace(/^(\s|\n|\r\n)*/, '').replace(/(\n|\r\n)/mg, '\\n');
      const srcLeading = fmtSource.substr(0, 10).replace(/(\s|\n|\r\n)*$/, '').replace(/(\n|\r\n)/mg, '\\n');
      errNear = `...${rstTrailing}>>>>>>${srcLeading}`;
    }
    fmtSign = sign;
    message = MESSAGES_MAP[sign](curIndex, brc);
  }

  function setFmtStatus() {
    if (isFmtError && !errIndex) {
      setFmtError('err');
      errFormat = true;
    } else if (isSrcValid) {
      if (signsQueue) {
        const expBracket = getBracketPair(signsQueue.substr(-1));
        setFmtError('end', expBracket);
      }
      setFmtError('scc');
    }
    fmtLines = curIndex;
  }

  /**
   * =================================================================
   * Util functions for the format.
   * =================================================================
   */

  function brkLine4Normal(str) {
    if (!fmtOptions.isExpand) return str;
    curIndex ++;
    return str + BREAK;
  }

  function brkLine4Special(str = '') {
    if (!fmtOptions.isExpand) return fmtResult += str;
    curIndex ++;
    fmtResult += BREAK + getCurIndent() + str;
  }

  function quoteNormalStr(qtStr, quote, isFromAbnormal = false) {
    const isEscape = fmtOptions.isEscape
      && fmtOptions.keyQtMark === '"'
      && quote === '"'
      && (!isFromAbnormal || fmtOptions.isStrict);
    qtStr = isFromAbnormal
      ? qtStr.replace(/(?!\\[b|f|n|\\|r|t|x|v|'|"|0])\\/mg, '\\\\')
      : qtStr.replace(/\\/mg, '\\\\');
    ESCAPES_MAP.forEach(esp => qtStr = qtStr.replace(esp.ptn, esp.str));
    const quote_ = isEscape ? `\\${quote}` : quote;
    if (isEscape) qtStr = qtStr.replace(/\\/mg, '\\\\');
    switch (quote) {
      case '"': 
        qtStr = isEscape ? qtStr.replace(/"/mg, '\\\\\\"') : qtStr.replace(/"/mg, '\\"');
        return quote_ + qtStr + quote_;
      case '\'':
        qtStr = qtStr.replace(/'/mg, '\\\'');
        return quote_ + qtStr + quote_;
      default: return qtStr;
    };
  }

  function quoteSpecialStr(qtStr, quoteMt, isProperty) {
    const quote = isProperty ? fmtOptions.keyQtMark : fmtOptions.valQtMark;
    qtStr = qtStr.replace(/(?!\\[b|f|n|\\|r|t|x|v|'|"|0])\\/mg, '');
    qtStr = qtStr.replace(/\\\"/mg, '\"');
    qtStr = qtStr.replace(/\\\'/mg, '\'');
    qtStr = quoteNormalStr(qtStr, quote, true);
    if (!fmtOptions.isStrict && quoteMt.length > 1) {
      qtStr = quoteMt.substr(0, quoteMt.length - 1) + qtStr;
    }
    return qtStr;
  }

  function getSrcRest(len = 1) {
    return fmtSource.length > len ? fmtSource.substr(len) : '';
  }

  function getNextQuotaIndex(quo, rest) {
    for (let i = 0; i < rest.length; i ++) {
      if (rest[i] === quo) {
        if (i === 0 || rest[i - 1] !== '\\' || (
          rest[i - 1] === '\\' && rest[i - 2] === '\\' && rest[i - 3] !== '\\'
        )) {
          return i;
        }
      }
    }
    return -1;
  }

  function getBaseIndent() {
    let indent = '';
    for (let i = 0; i < fmtOptions.indent; i++) {
      indent += SPACE;
    }
    return indent;
  }

  function getCurIndent() {
    let indent = '';
    for (let i = 0; i < curLevel; i++) {
      indent += baseIndent;
    }
    return indent;
  }

  function getBracketPair(braSign) {
    const pre = ['{', '[', '('];
    const end = ['}', ']', ')'];
    const preIdx = pre.indexOf(braSign);
    const endIdx = end.indexOf(braSign);
    return preIdx > -1 ? end[preIdx] : pre[endIdx];
  }
  
  /**
   * =================================================================
   * UMD modules define.
   * =================================================================
   */
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return formatToJson;
    });
  } else if (typeof exports === 'object') {
    module.exports = formatToJson;
  } else {
    root.formatToJson = formatToJson;
  }

}(this));