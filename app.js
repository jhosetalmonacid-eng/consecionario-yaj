// ============================================
// CONFIGURACIÓN DEL CONCESIONARIO YAJ
// ============================================

const URL_INVENTARIO = "data/inventario.json";
const URL_GARANTIAS = "data/garantias.xml";
const URL_TASA_CAMBIO = "https://open.er-api.com/v6/latest/USD";

const TASA_RESPALDO = 4000;
// ============================================
// FORMATO DE PRECIOS
// ============================================

function formatearCOP(valor) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(valor);
}

function formatearUSD(valor) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
    }).format(valor);
}

let inventario = [];
let tasaCambio = TASA_RESPALDO;
let tasaAproximada = true;
let vehiculoActual = null;


// ============================================
// ELEMENTOS DEL HTML
// ============================================

const listaVehiculos = document.getElementById("lista-vehiculos");
const calculadoraContenido = document.getElementById("calculadora-contenido");
const listaGarantias = document.getElementById("lista-garantias");
const vehiculoSeleccionado = document.getElementById("vehiculo-seleccionado");
const formularioCompra = document.getElementById("formulario-compra");
// OBTENER LA TASA DE CAMBIO
async function cargarTasaCambio() {
    try {
        const respuesta = await fetch(URL_TASA_CAMBIO);

        if (!respuesta.ok) {
            throw new Error("No se pudo consultar la tasa de cambio");
        }

        const datos = await respuesta.json();

        if (datos.result === "success" && datos.rates.COP > 0) {
            tasaCambio = datos.rates.COP;
            tasaAproximada = false;
        }
    } catch (error) {
        tasaCambio = TASA_RESPALDO;
        tasaAproximada = true;
        console.warn("Se utilizará una tasa de cambio aproximada.");
    }
}
// ============================================
// CARGAR INVENTARIO
// ============================================

async function cargarInventario() {
    try {
        const respuesta = await fetch(URL_INVENTARIO);

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el inventario");
        }

        inventario = await respuesta.json();
        mostrarVehiculos();

    } catch (error) {
        listaVehiculos.innerHTML =
            "<p>No fue posible cargar el inventario. Verifica el archivo JSON.</p>";

        console.error("Error al cargar inventario:", error);
    }
}


// ============================================
// MOSTRAR TARJETAS DE VEHÍCULOS
// ============================================

function mostrarVehiculos() {
    listaVehiculos.innerHTML = "";

    if (inventario.length === 0) {
        listaVehiculos.innerHTML = "<p>No hay vehículos disponibles.</p>";
        return;
    }

    inventario.forEach(function (vehiculo) {
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta-vehiculo";

        const precioCOP = vehiculo.precioUSD * tasaCambio;

        const detalle = vehiculo.tipo === "moto"
            ? "Cilindraje: " + vehiculo.cilindraje
            : "Transmisión: " + vehiculo.transmision;

        tarjeta.innerHTML = `
            <img
                src="${vehiculo.imagen}"
                alt="${vehiculo.marca} ${vehiculo.modelo}"
                class="imagen-vehiculo"
            >

            <div class="contenido-tarjeta">
                <h3>${vehiculo.marca} ${vehiculo.modelo}</h3>
                <p>Año: ${vehiculo["año"]}</p>
                <p>${detalle || ""}</p>
                <p>Precio original: ${formatearUSD(vehiculo.precioUSD)}</p>
                <p class="precio-vehiculo">${formatearCOP(precioCOP)}</p>

                <button
                    type="button"
                    class="boton seleccionar-vehiculo"
                    data-id="${vehiculo.id}"
                >
                    Seleccionar vehículo
                </button>
            </div>
        `;

        listaVehiculos.appendChild(tarjeta);
    });
}
// ============================================
// SELECCIONAR VEHÍCULO
// ============================================

listaVehiculos.addEventListener("click", function (evento) {
    const boton = evento.target.closest(".seleccionar-vehiculo");

    if (!boton) {
        return;
    }

    const id = Number(boton.dataset.id);

    vehiculoActual = inventario.find(function (vehiculo) {
        return Number(vehiculo.id) === id;
    });

    if (!vehiculoActual) {
        return;
    }

    mostrarVehiculoSeleccionado();
    mostrarCalculadora();

    document.getElementById("calculadora").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// ============================================
// MOSTRAR VEHÍCULO SELECCIONADO
// ============================================

function mostrarVehiculoSeleccionado() {
    vehiculoSeleccionado.innerHTML = `
        <h3>Vehículo seleccionado</h3>
        <p>${vehiculoActual.marca} ${vehiculoActual.modelo}</p>
        <p>Año: ${vehiculoActual["año"]}</p>
        <p>Precio original: ${formatearUSD(vehiculoActual.precioUSD)}</p>
    `;
}


// ============================================
// MOSTRAR CALCULADORA
// ============================================

function mostrarCalculadora() {
    const precioCOP = vehiculoActual.precioUSD * tasaCambio;

    calculadoraContenido.innerHTML = `
        <h3>${vehiculoActual.marca} ${vehiculoActual.modelo}</h3>

        <p>Precio base: ${formatearCOP(precioCOP)}</p>

        <label for="forma-pago">Selecciona la forma de pago:</label>

        <select id="forma-pago">
            <option value="contado">Contado (5 % de descuento)</option>
            <option value="credito">Crédito (10 % de recargo)</option>
        </select>

        <div id="resultado-calculadora" aria-live="polite"></div>

        <button
            type="button"
            class="boton"
            id="boton-solicitud-compra"
        >
            Hacer solicitud de compra
        </button>
    `;

    const formaPago = document.getElementById("forma-pago");

    formaPago.addEventListener("change", calcularPrecio);

    document
        .getElementById("boton-solicitud-compra")
        .addEventListener("click", function () {
            mostrarVehiculoSeleccionado();

            document.getElementById("solicitud-compra").scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        });

    calcularPrecio();
}
// ============================================
// CALCULAR PRECIO FINAL
// ============================================

function calcularPrecio() {
    if (!vehiculoActual) {
        return;
    }

    const precioBase = vehiculoActual.precioUSD * tasaCambio;
    const formaPago = document.getElementById("forma-pago").value;

    let precioFinal;
    let ajuste;

    if (formaPago === "contado") {
        ajuste = precioBase * 0.05;
        precioFinal = precioBase - ajuste;
    } else {
        ajuste = precioBase * 0.10;
        precioFinal = precioBase + ajuste;
    }

    document.getElementById("resultado-calculadora").innerHTML = `
        <p>${formaPago === "contado" ? "Descuento del 5 %" : "Recargo del 10 %"}: ${formatearCOP(ajuste)}</p>
        <h3>Precio final: ${formatearCOP(precioFinal)}</h3>
        <p>${tasaAproximada
            ? "Tasa de cambio aproximada: " + formatearCOP(tasaCambio) + " por USD."
            : "Conversión realizada con la tasa de cambio consultada."}</p>
    `;
}
// ============================================
// CARGAR GARANTÍAS DESDE XML
// ============================================

async function cargarGarantias() {
    try {
        const respuesta = await fetch(URL_GARANTIAS);

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el archivo XML");
        }

        const textoXML = await respuesta.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(textoXML, "application/xml");

        if (xml.querySelector("parsererror")) {
            throw new Error("El archivo XML tiene un formato incorrecto");
        }

        const garantias = xml.querySelectorAll("garantias > vehiculo");

        if (garantias.length === 0) {
            listaGarantias.innerHTML = "<p>No hay garantías disponibles.</p>";
            return;
        }

        listaGarantias.innerHTML = "";

        garantias.forEach(function (garantia) {
            const tipo = garantia.getAttribute("tipo");
            const duracion = garantia.querySelector("duracion")?.textContent ?? "No especificada";
            const kilometraje = garantia.querySelector("kilometraje")?.textContent ?? "No especificado";
            const cobertura = garantia.querySelector("cobertura")?.textContent ?? "No especificada";

            const tarjeta = document.createElement("article");
            tarjeta.className = "tarjeta-garantia";

            tarjeta.innerHTML = `
                <h3>Garantía para ${tipo === "moto" ? "motocicletas" : "carros"}</h3>
                <p><strong>Duración:</strong> ${duracion}</p>
                <p><strong>Kilometraje:</strong> ${kilometraje}</p>
                <p><strong>Cobertura:</strong> ${cobertura}</p>
            `;

            listaGarantias.appendChild(tarjeta);
        });

    } catch (error) {
        listaGarantias.innerHTML =
            "<p>No fue posible cargar las garantías. Verifica data/garantias.xml.</p>";

        console.error("Error al cargar garantías:", error);
    }
}
// ============================================
 // FORMULARIO DE SOLICITUD DE COMPRA
 // ============================================

 formularioCompra.addEventListener("submit", function (evento) {
    evento.preventDefault();

    if (!vehiculoActual) {
        alert("Primero debes seleccionar un vehículo del catálogo.");
        return;
    }

    const nombre = document.getElementById("nombre").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const correo = document.getElementById("correo").value.trim();

    if (!nombre || !telefono || !correo) {
        alert("Completa todos los campos del formulario.");
        return;
    }

    const formaPago = document.getElementById("forma-pago");
    const precioBase = vehiculoActual.precioUSD * tasaCambio;
    const pagoContado = formaPago && formaPago.value === "contado";

    const precioFinal = pagoContado
        ? precioBase * 0.95
        : precioBase * 1.10;

    const mensajeAnterior = document.getElementById("mensaje-confirmacion");

    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }

    const confirmacion = document.createElement("div");
    confirmacion.id = "mensaje-confirmacion";
    confirmacion.className = "mensaje-exito";

    confirmacion.innerHTML = `
        <h3>¡Solicitud de compra registrada!</h3>
        <p>Gracias, <strong>${nombre}</strong>. Hemos registrado tu solicitud.</p>
        <hr>
        <p><strong>Vehículo:</strong> ${vehiculoActual.marca} ${vehiculoActual.modelo}</p>
        <p><strong>Año:</strong> ${vehiculoActual["año"]}</p>
        <p><strong>Teléfono:</strong> ${telefono}</p>
        <p><strong>Correo electrónico:</strong> ${correo}</p>
        <p><strong>Forma de pago:</strong> ${pagoContado ? "Contado" : "Crédito"}</p>
        <p><strong>Precio calculado:</strong> ${formatearCOP(precioFinal)}</p>
        <p class="nota-confirmacion">¡Gracias por confiar en YAJ! Nuestro equipo está listo para atender tu solicitud.</p>
    `;

    formularioCompra.insertAdjacentElement("afterend", confirmacion);

    formularioCompra.reset();

    confirmacion.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});
// ============================================
// INICIAR APLICACIÓN YAJ
// ============================================

async function iniciarAplicacion() {
    await cargarTasaCambio();
    await cargarInventario();
    await cargarGarantias();
}

iniciarAplicacion();