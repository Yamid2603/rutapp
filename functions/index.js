// Entry point de Cloud Functions
const { initializeApp } = require('firebase-admin/app');
initializeApp();

const { analisisIASemanal } = require('./analisisIA-semanal');
const { chatbotProcesarConsulta } = require('./chatbot-procesarConsulta');
const { crearConductor } = require('./crearConductor');
const { desactivarConductor } = require('./desactivarConductor');
const { resumenMensual } = require('./resumenMensual');
const { sugerenciasRuta } = require('./sugerenciasRuta');

exports.analisisIASemanal = analisisIASemanal;
exports.chatbotProcesarConsulta = chatbotProcesarConsulta;
exports.crearConductor = crearConductor;
exports.desactivarConductor = desactivarConductor;
exports.resumenMensual = resumenMensual;
exports.sugerenciasRuta = sugerenciasRuta;
