async function criarConta(){

const nome = document.getElementById("nome").value
const email = document.getElementById("email").value
const telefone = document.getElementById("telefone").value
const senha = document.getElementById("senha").value
const confirmar = document.getElementById("confirmarSenha").value

const mensagem = document.getElementById("mensagem")

if(!nome || !email || !senha){
mensagem.innerText = "Preencha nome, email e senha."
return
}

if(senha !== confirmar){
mensagem.innerText = "As senhas não conferem."
return
}

const {data, error} = await supabaseClient.auth.signUp({
email: email,
password: senha
})

if(data.user){

await supabaseClient
.from("usuarios")
.insert({
  user_id: data.user.id,
  nome: nome,
  telefone: telefone
})

}

if(error){
mensagem.innerText = error.message
return
}

const user = data.user

if(user){

await supabaseClient
.from("usuarios")
.insert({
user_id: user.id,
nome: nome,
telefone: telefone
})

}

mensagem.innerText = "Conta criada com sucesso!"

setTimeout(()=>{
window.location.href="login.html"
},1500)

}


function voltarLogin(){
window.location.href="login.html"
}


function toggleSenha(){

const campo = document.getElementById("senha")

if(campo.type === "password"){
campo.type = "text"
}else{
campo.type = "password"
}

}