export const CADASTRO_FORMAT_MESSAGE =
    "Não consegui entender o número ou o nome. Use o DDD, por exemplo:\nCadastrar pessoa (31)999999999 Victor";

export const CADASTRO_SELF_MESSAGE =
    "Você não pode cadastrar o próprio número. Para adicionar outra pessoa, envie:\nCadastrar pessoa (31)999999999 Nome";

export function cadastroDuplicateNicknameMessage(name: string): string {
    return `Você já tem um contato chamado ${name}. Envie Contatos para ver a lista ou escolha outro nome.`;
}

export function cadastroAlreadyPendingMessage(name: string): string {
    return `Já existe um convite pendente para ${name}. Assim que a pessoa aceitar, você poderá enviar: Lembre o ${name} amanhã às 10h de…`;
}

export function cadastroAlreadyAcceptedMessage(name: string): string {
    return `${name} já está nos seus contatos. Para agendar: Lembre o ${name} amanhã às 10h de…\nEnvie Contatos para ver a lista.`;
}

export function cadastroReversePendingMessage(): string {
    return "Essa pessoa já te enviou um convite. Responda sim ou não (ou reaja com 👍 / 👎) na mensagem do convite.";
}

export function cadastroSendFailedMessage(): string {
    return "Não consegui entregar o convite. Confira o DDD e o número e tente de novo:\nCadastrar pessoa (31)999999999 Nome";
}

export function cadastroInviteSentMessage(name: string): string {
    return `Convite enviado para ${name}. Você será avisado quando a pessoa responder.\nDepois que aceitar, envie: Lembre o ${name} amanhã às 10h de…\nEnvie Contatos para ver seus convites.`;
}

export function inviteToInviteeMessage(inviterName: string): string {
    return `${inviterName} quer te cadastrar como um contato para agendar lembretes, deseja aceitar?\nResponda sim ou não, ou reaja com 👍 / 👎.`;
}

export function inviteAcceptedInviteeMessage(inviterContactName: string): string {
    return `Ótimo! Agora vocês podem agendar lembretes um para o outro. ${inviterContactName} está nos seus contatos.\nEnvie Contatos para listar seus contatos.\nExemplo: Lembre a ${inviterContactName} amanhã 12h de passear com o cachorro`;
}

export function inviteAcceptedInviterMessage(inviteeNickname: string): string {
    return `${inviteeNickname} aceitou seu convite. Vocês já podem agendar lembretes um para o outro.\nExemplo: Lembre o ${inviteeNickname} amanhã às 10h de…`;
}

export function inviteRejectedInviteeMessage(inviterName: string): string {
    return `Ok, você recusou o convite para ser contato da ${inviterName}.`;
}

export function inviteRejectedInviterMessage(inviteeNickname: string): string {
    return `${inviteeNickname} recusou o convite para ser seu contato.`;
}

export function inviteUnknownReactionMessage(): string {
    return "Não entendi essa reação. Responda sim ou não, ou use 👍 para aceitar e 👎 para recusar.";
}

export const CONTATOS_EMPTY_MESSAGE =
    "Você ainda não tem contatos. Para adicionar, envie:\nCadastrar pessoa (31)999999999 Nome";

export function contatosListMessage(acceptedLines: string, pendingLines: string): string {
    const parts = ["📒 *Seus contatos*"];
    if (acceptedLines) {
        parts.push("", acceptedLines);
    }
    if (pendingLines) {
        parts.push("", "⏳ *Convites aguardando resposta*", pendingLines);
    }
    parts.push("", "Para agendar: Lembre a Nome amanhã 12h de…");
    return parts.join("\n");
}

export function reminderUnknownContactMessage(name: string): string {
    return `Não encontrei ${name} nos seus contatos. Envie Contatos para ver a lista ou cadastre com:\nCadastrar pessoa (31)999999999 ${name}`;
}

export function reminderOwnerMissingMessage(name: string): string {
    return `${name} ainda não conversou com o bot depois de aceitar. Peça para a pessoa enviar qualquer mensagem aqui e tente de novo.`;
}

export function reminderCreatedForOtherSuffix(name: string): string {
    return ` para ${name}. Envie listar para ver esse lembrete em *Agendados para outros* (somente leitura).`;
}

export function reminderCreatedForYouMessage(
    creatorName: string,
    title: string,
    when: string,
): string {
    return `${creatorName} criou um lembrete para você: *${title}* — ${when}\nEle é seu: você pode apagar ou adiar. Envie listar para ver.`;
}

export function reminderExtractFailedForContactMessage(nickname: string): string {
    return `Não consegui criar o lembrete para ${nickname}. Tente de novo com data e hora claras.\nExemplo: Lembre o ${nickname} amanhã às 10h de…\nEnvie listar para ver seus lembretes.\nEnvie Contatos para ver seus contatos.`;
}

export function reminderPartialCreateFailedMessage(nickname?: string): string {
    const prefix = nickname
        ? `Ocorreu um erro ao criar todos os lembretes para ${nickname}.`
        : "Ocorreu um erro ao criar todos os lembretes.";
    return `${prefix} Alguns podem ter sido criados. Envie listar para conferir.`;
}
