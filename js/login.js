async function verificarSessao() {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "index.html";
  }

}

// verificarSessao();


function mostrarLogin(){
document.getElementById("welcome").classList.add("hidden")
document.getElementById("login").classList.remove("hidden")
}

function toggleSenha(){

const campo = document.getElementById("senha")

if(campo.type === "password"){
campo.type = "text"
}else{
campo.type = "password"
}

}
function toggleSenha(){

const campo = document.getElementById("senha")
const icone = document.getElementById("icone-olho")

if(campo.type === "password"){

campo.type = "text"

icone.innerHTML = `
<path d="M2 12c2-4 6-6 10-6s8 2 10 6c-2 4-6 6-10 6s-8-2-10-6z" fill="none" stroke="#333" stroke-width="2"/>
<circle cx="12" cy="12" r="3" fill="#333"/>
`

}else{

campo.type = "password"

icone.innerHTML = `
<path d="M3 13c3-4 15-4 18 0" stroke="#333" stroke-width="2" fill="none"/>
<path d="M7 15l-1 2" stroke="#333" stroke-width="2"/>
<path d="M12 15v2" stroke="#333" stroke-width="2"/>
<path d="M17 15l1 2" stroke="#333" stroke-width="2"/>
`

}

}

async function login(){

const email = document.getElementById("email").value
const senha = document.getElementById("senha").value

const {data,error} = await supabaseClient.auth.signInWithPassword({
email:email,
password:senha
})

if(error){
document.getElementById("mensagem").innerText="Erro no login"
return
}

window.location.href="index.html"

}


async function criarConta(){

const email = document.getElementById("email").value
const senha = document.getElementById("senha").value

const {data,error} = await supabaseClient.auth.signUp({
email:email,
password:senha
})

if(error){
document.getElementById("mensagem").innerText="Erro ao criar conta"
return
}

document.getElementById("mensagem").innerText="Conta criada! Faça login."

}

function abrirCadastro(){
window.location.href = "cadastro.html"
}