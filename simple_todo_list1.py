import json
import os
import time
import threading
import urllib.parse
import urllib.request
from datetime import datetime

FILE_NAME = "tasks.json"
DEFAULT_REMIND_BEFORE = 30  # minutes

# Phone alert settings (uses free ntfy.sh service - no signup needed).
# Install the "ntfy" app on your phone and subscribe to this SAME topic name.
# Change it to something unique so nobody else gets/sends your alerts.
NTFY_TOPIC = "todo-milan-7k3q9x"


def load_tasks():
    if not os.path.exists(FILE_NAME):
        return []

    try:
        with open(FILE_NAME, "r") as file:
            return json.load(file)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_tasks(tasks):
    with open(FILE_NAME, "w") as file:
        json.dump(tasks, file, indent=4)


def send_alert(title, message):
    """Send a push notification (with sound) to the phone via ntfy.sh."""
    params = urllib.parse.urlencode({
        "title": title,
        "message": message,
        "priority": "5",          # 5 = urgent (loud + vibrate)
        "tags": "alarm_clock"
    })
    url = f"https://ntfy.sh/{NTFY_TOPIC}/publish?{params}"

    try:
        urllib.request.urlopen(url, timeout=10)
        return True
    except Exception:
        return False


def schedule_reminder(task):
    """
    Calculate task time and reminder time from due_date + due_time.
    Example: task at 12:00, remind_before 30 -> alert at 11:30.
    Returns False if the task time has already passed.
    """
    if not task.get("due_time"):
        task["task_at"] = None
        task["alert_at"] = None
        return True

    date_text = task["due_date"] or datetime.now().strftime("%d-%m-%Y")
    task_at = datetime.strptime(
        f'{date_text} {task["due_time"]}', "%d-%m-%Y %H:%M"
    ).timestamp()

    if task_at <= time.time():
        print("That time has already passed. Reminder not set.")
        task["due_time"] = ""
        task["task_at"] = None
        task["alert_at"] = None
        return False

    task["due_date"] = date_text
    task["task_at"] = task_at
    task["alert_at"] = task_at - task.get("remind_before", DEFAULT_REMIND_BEFORE) * 60
    task["alerted"] = False
    return True


def format_time_left(task):
    """Return time remaining until the task time."""
    task_at = task.get("task_at")

    if task["completed"]:
        return "Done"
    if not task_at:
        return "No task time set"

    remaining = int(task_at - time.time())

    if remaining <= 0:
        return "TIME PASSED"

    hours, rest = divmod(remaining, 3600)
    minutes, seconds = divmod(rest, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d} left"


def deadline_watcher(tasks):
    """Background thread: checks reminders every second and raises the alert."""
    while True:
        for task in tasks:
            alert_at = task.get("alert_at")

            if (
                alert_at
                and not task["completed"]
                and not task.get("alerted")
                and time.time() >= alert_at
            ):
                task["alerted"] = True
                save_tasks(tasks)

                minutes_left = max(0, round((task["task_at"] - time.time()) / 60))
                message = (
                    f'{task["title"]} is due at {task["due_time"]} '
                    f'(in about {minutes_left} min). '
                    f'Priority: {task["priority"]}. Do it now!'
                )

                print(f'\n\a*** REMINDER: {message} ***')
                ok = send_alert("Task Reminder", message)
                print("Phone alert sent." if ok else "Could not send phone alert (check internet).")

        time.sleep(1)


def display_tasks(tasks):
    if not tasks:
        print("\nNo tasks found.")
        return

    print("\n" + "=" * 60)
    print("                    TO-DO LIST")
    print("=" * 60)

    for task in tasks:
        status = "Completed" if task["completed"] else "Pending"
        due = task["due_date"] if task["due_date"] else "No due date"

        if task.get("due_time"):
            due += " " + task["due_time"]

        if not task.get("alert_at"):
            reminder = "Not set"
        elif task.get("alerted"):
            reminder = "Sent"
        else:
            reminder = f'{task.get("remind_before", DEFAULT_REMIND_BEFORE):g} min before task time'

        print("ID       :", task["id"])
        print("Task     :", task["title"])
        print("Priority :", task["priority"])
        print("Due      :", due)
        print("Time Left:", format_time_left(task))
        print("Reminder :", reminder)
        print("Status   :", status)
        print("-" * 60)


def ask_time(prompt):
    """Ask for time in HH:MM (24-hour). Returns text or '' if skipped/invalid."""
    value = input(prompt).strip()

    if not value:
        return ""

    try:
        datetime.strptime(value, "%H:%M")
        return value
    except ValueError:
        print("Invalid time. Use HH:MM in 24-hour format, e.g. 12:00 or 18:30.")
        return ""


def ask_remind_before(prompt, default):
    """Ask minutes before task time to send the reminder."""
    value = input(prompt).strip()

    if not value:
        return default

    try:
        minutes = float(value)
        if minutes <= 0:
            raise ValueError
        return minutes
    except ValueError:
        print(f"Invalid number. Using {default:g} minutes.")
        return default


def add_task(tasks):
    title = input("Enter task name: ").strip()

    if not title:
        print("Task name cannot be empty.")
        return

    priority = input("Enter priority (High/Medium/Low): ").strip().capitalize()

    if priority not in ["High", "Medium", "Low"]:
        priority = "Medium"

    due_date = input(
        "Enter due date (DD-MM-YYYY) or press Enter for today/skip: "
    ).strip()

    if due_date:
        try:
            datetime.strptime(due_date, "%d-%m-%Y")
        except ValueError:
            print("Invalid date format. Due date skipped.")
            due_date = ""

    due_time = ask_time("Enter task time (HH:MM, 24-hour) or press Enter to skip: ")

    remind_before = DEFAULT_REMIND_BEFORE
    if due_time:
        remind_before = ask_remind_before(
            f"Remind me how many minutes before? [{DEFAULT_REMIND_BEFORE}]: ",
            DEFAULT_REMIND_BEFORE
        )

    new_id = max([task["id"] for task in tasks], default=0) + 1

    task = {
        "id": new_id,
        "title": title,
        "priority": priority,
        "due_date": due_date,
        "due_time": due_time,
        "remind_before": remind_before,
        "task_at": None,
        "alert_at": None,
        "alerted": False,
        "completed": False
    }

    schedule_reminder(task)

    tasks.append(task)
    save_tasks(tasks)
    print("Task added successfully!")

    if task["alert_at"]:
        alert_time = datetime.fromtimestamp(task["alert_at"]).strftime("%d-%m-%Y %H:%M")
        print(f"Reminder will be sent at {alert_time}.")


def update_task(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to update: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:
            schedule_changed = False

            new_title = input(
                f'Enter new task name [{task["title"]}]: '
            ).strip()

            if new_title:
                task["title"] = new_title

            new_priority = input(
                f'Enter priority (High/Medium/Low) [{task["priority"]}]: '
            ).strip().capitalize()

            if new_priority in ["High", "Medium", "Low"]:
                task["priority"] = new_priority

            new_due = input(
                f'Enter due date [{task["due_date"] or "None"}]: '
            ).strip()

            if new_due:
                try:
                    datetime.strptime(new_due, "%d-%m-%Y")
                    task["due_date"] = new_due
                    schedule_changed = True
                except ValueError:
                    print("Invalid date. Old due date kept.")

            new_time = ask_time(
                f'Enter task time HH:MM [{task.get("due_time") or "None"}]: '
            )

            if new_time:
                task["due_time"] = new_time
                schedule_changed = True

            if task.get("due_time"):
                new_remind = ask_remind_before(
                    f'Remind before (minutes) [{task.get("remind_before", DEFAULT_REMIND_BEFORE):g}]: ',
                    task.get("remind_before", DEFAULT_REMIND_BEFORE)
                )

                if new_remind != task.get("remind_before", DEFAULT_REMIND_BEFORE):
                    task["remind_before"] = new_remind
                    schedule_changed = True

            if schedule_changed:
                schedule_reminder(task)

            save_tasks(tasks)
            print("Task updated successfully!")
            return

    print("Task ID not found.")


def mark_completed(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to mark completed: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:
            task["completed"] = True
            save_tasks(tasks)
            print("Task marked as completed!")
            return

    print("Task ID not found.")


def delete_task(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to delete: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:
            tasks.remove(task)
            save_tasks(tasks)
            print("Task deleted successfully!")
            return

    print("Task ID not found.")


def alert_phone_now(tasks):
    """Prototype button: manually send an alert for a task to the phone."""
    pending = [task for task in tasks if not task["completed"]]

    if not pending:
        print("No pending tasks to alert about.")
        return

    display_tasks(pending)

    try:
        task_id = int(input("Enter task ID to alert on phone: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in pending:
        if task["id"] == task_id:
            ok = send_alert(
                "Task Reminder",
                f'Do this task now: {task["title"]} (Priority: {task["priority"]})'
            )
            print("Alert sent to phone!" if ok else "Could not send alert (check internet).")
            return

    print("Task ID not found.")


def main():
    tasks = load_tasks()

    # Start the background reminder checker
    watcher = threading.Thread(target=deadline_watcher, args=(tasks,), daemon=True)
    watcher.start()

    while True:
        print("\n========== SIMPLE TO-DO LIST ==========")
        print("1. Add Task")
        print("2. View Tasks")
        print("3. Update Task")
        print("4. Mark Task as Completed")
        print("5. Delete Task")
        print("6. Send Alert to Phone")
        print("7. Exit")
        print("=======================================")

        choice = input("Enter your choice (1-7): ").strip()

        if choice == "1":
            add_task(tasks)
        elif choice == "2":
            display_tasks(tasks)
        elif choice == "3":
            update_task(tasks)
        elif choice == "4":
            mark_completed(tasks)
        elif choice == "5":
            delete_task(tasks)
        elif choice == "6":
            alert_phone_now(tasks)
        elif choice == "7":
            print("Thank you for using the To-Do List!")
            break
        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()
