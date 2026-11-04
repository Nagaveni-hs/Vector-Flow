import EventForm from "@/components/EventForm";

export default function NewEvent() {
  return (
    <div className="admin-content-page event-create-page">
      <h1>Create a new event</h1>
      <EventForm />
    </div>
  );
}
