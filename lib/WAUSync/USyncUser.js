/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncUser {
    withId(id) {
        this.id = id;
        return this;
    }
    withLid(lid) {
        this.lid = lid;
        return this;
    }
    withPhone(phone) {
        this.phone = phone;
        return this;
    }
    withUsername(username) {
        this.username = username;
        return this;
    }
    withUsernameKey(usernameKey) {
        this.usernameKey = usernameKey;
        return this;
    }
    withType(type) {
        this.type = type;
        return this;
    }
    withPersonaId(personaId) {
        this.personaId = personaId;
        return this;
    }
}
