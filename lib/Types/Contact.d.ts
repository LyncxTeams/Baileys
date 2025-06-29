"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactAction = exports.Contact = void 0;

const Contact = {
    /** ID either in lid or jid format */
    id: '',
    /** ID in Lid (anonymous) format (@lid) */
    lid: undefined,
    /** ID in Phone Number format (@s.whatsapp.net) */
    jid: undefined,
    /** name of the contact, you have saved on your WA */
    name: undefined,
    /** name of the contact, the contact has set on their own on WA */
    notify: undefined,
    /** I have no idea */
    verifiedName: undefined,
    /**
     * Url of the profile picture of the contact
     *
     * 'changed' => if the profile picture has changed
     * null => if the profile picture has not been set (default profile picture)
     * any other string => url of the profile picture
     */
    imgUrl: undefined,
    status: undefined
};
exports.Contact = Contact;

const ContactAction = {
    firstName: '',
    fullName: '',
    saveOnPrimaryAddressbook: false
};
exports.ContactAction = ContactAction;
