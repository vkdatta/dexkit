import {
  handleFormat,
  handleFormatSubmit,
  handleBulletList,
  handleNumberedList,
  handleListSubmit,
  handleInsertLink,
  handleLinkSubmit,
  handleInsertImage,
  handleImageSubmit,
  handleUppercase,
  handleLowercase,
  handleAlignLeft,
  handleAlignCenter,
  handleAlignRight,
  increaseIndentation,
  decreaseIndentation,
  handleSelectAll,
  handleCopyNote,
  handleCutNote,
  handleClearNote,
  handlePasteNote,
  reverseText,
  reverseWords,
  capitalizeWords,
  capitalizeSentences
} from "./formatting.js";
import { registerFont, openFontPickerModal } from "./fontpicker.js";

window.registerFont = registerFont;
window.openFontPickerModal = openFontPickerModal;
window.handleFormat = handleFormat;
window.handleFormatSubmit = handleFormatSubmit;
window.handleBulletList = handleBulletList;
window.handleNumberedList = handleNumberedList;
window.handleListSubmit = handleListSubmit;
window.handleInsertLink = handleInsertLink;
window.handleLinkSubmit = handleLinkSubmit;
window.handleInsertImage = handleInsertImage;
window.handleImageSubmit = handleImageSubmit;
window.handleUppercase = handleUppercase;
window.handleLowercase = handleLowercase;
window.handleAlignLeft = handleAlignLeft;
window.handleAlignCenter = handleAlignCenter;
window.handleAlignRight = handleAlignRight;
window.increaseIndentation = increaseIndentation;
window.decreaseIndentation = decreaseIndentation;
window.handleSelectAll = handleSelectAll;
window.handleCopyNote = handleCopyNote;
window.handleCutNote = handleCutNote;
window.handleClearNote = handleClearNote;
window.handlePasteNote = handlePasteNote;
window.reverseText = reverseText;
window.reverseWords = reverseWords;
window.capitalizeWords = capitalizeWords;
window.capitalizeSentences = capitalizeSentences;
