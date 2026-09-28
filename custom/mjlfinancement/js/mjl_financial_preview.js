(function (root) {
  'use strict';
  var maximum = 9223372036854775807n;
  function parse(value) {
    var text = String(value == null ? '' : value);
    if (text === '') return null;
    if (!/^(0|[1-9][0-9]*)$/.test(text)) return false;
    var amount = BigInt(text);
    return amount <= maximum ? amount : false;
  }
  function display(value) {
    if (value === false) return 'Saisie invalide';
    if (value === null) return 'Non renseigné';
    var raw = value.toString();
    var negative = raw.charAt(0) === '-';
    if (negative) raw = raw.slice(1);
    return (negative ? '-' : '') + raw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F CFA';
  }
  function summary(activityValue, operationValues) {
    var activity = parse(activityValue);
    var total = 0n;
    var missing = false;
    var invalid = false;
    Array.prototype.forEach.call(operationValues, function (value) {
      var amount = parse(value);
      if (amount === false) invalid = true;
      else if (amount === null) missing = true;
      else total += amount;
    });
    var operations = invalid || total > maximum ? false : missing ? null : total;
    var difference = activity === false || operations === false ? false :
      activity === null || operations === null ? null : activity - operations;
    return {
      activity: display(activity),
      operations: display(operations),
      difference: difference === 0n ? '-' : display(difference)
    };
  }
  root.MjlFinance = { summary: summary };
})(window);
